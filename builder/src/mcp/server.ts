/**
 * MCP Server próprio — Builder exposto como MCP server.
 *
 * Pode ser carregado por Claude Code, Cursor, Cline, etc:
 *
 *   {
 *     "mcpServers": {
 *       "mcp-builder": {
 *         "command": "npx",
 *         "args": ["@mcp-builder/cli", "serve"]
 *       }
 *     }
 *   }
 *
 * Tools expostas:
 *   - create_project(spec)           → gera novo MCP server
 *   - add_tool(projectPath, tool)    → adiciona tool a projeto existente
 *   - add_hook(projectPath, hook)    → adiciona hook customizado
 *   - run_tests(projectPath)         → roda testes do projeto
 *   - validate_spec(spec)            → valida MCPSpec
 *   - transition_state(projectPath, event)  → dispara transição FSM
 *   - list_templates()               → lista templates disponíveis
 *   - fsm_show()                     → retorna diagrama Mermaid
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Scaffolder } from '../scaffolder/index.js';
import { FSM } from '../fsm/index.js';
import { validateMCPSpec } from '../validator/index.js';
import { HookRegistry } from '../hooks/registry.js';
import { createLogger } from '../logger/index.js';
import { readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Logger, MCPSpec } from '../types.js';

const execFileAsync = promisify(execFile);

export interface MCPServerOptions {
  logger?: Logger;
  templatesRoot?: string;
  repoRoot?: string;
}

export async function startMCPServer(opts: MCPServerOptions = {}): Promise<void> {
  const logger = opts.logger ?? createLogger();
  const templatesRoot = opts.templatesRoot ?? findDefault('templates');
  const repoRoot = opts.repoRoot ?? findDefault('repo');

  const _hookRegistry = new HookRegistry(logger);
  void _hookRegistry; // hooks default viriam de ../hooks/defaults — por ora registry vazio

  const server = new Server(
    { name: 'mcp-builder', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  // ==========================================================================
  // ListTools
  // ==========================================================================
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'create_project',
        description: 'Scaffold a new MCP server project from a spec',
        inputSchema: {
          type: 'object',
          required: ['name', 'sdk', 'pattern'],
          properties: {
            name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$' },
            sdk: { enum: ['python', 'typescript', 'go', 'rust'] },
            pattern: { enum: ['event', 'factory', 'stateless'] },
            tools: { type: 'array', items: { type: 'object' } },
            output: { type: 'string', description: 'output directory (default: ./)' },
          },
        },
      },
      {
        name: 'add_tool',
        description: 'Add a new tool to an existing MCP server project',
        inputSchema: {
          type: 'object',
          required: ['projectPath', 'tool'],
          properties: {
            projectPath: { type: 'string' },
            tool: { type: 'object', required: ['name', 'description', 'inputSchema'] },
          },
        },
      },
      {
        name: 'run_tests',
        description: 'Run the test suite of a generated MCP server project',
        inputSchema: {
          type: 'object',
          required: ['projectPath'],
          properties: {
            projectPath: { type: 'string' },
            suite: { enum: ['unit', 'contract', 'e2e', 'property', 'mutation', 'all'], default: 'all' },
          },
        },
      },
      {
        name: 'validate_spec',
        description: 'Validate an MCPSpec JSON before scaffolding',
        inputSchema: {
          type: 'object',
          required: ['spec'],
          properties: {
            spec: { type: 'object' },
          },
        },
      },
      {
        name: 'transition_state',
        description: 'Compute and apply an FSM transition on a project',
        inputSchema: {
          type: 'object',
          required: ['projectPath', 'event'],
          properties: {
            projectPath: { type: 'string' },
            event: { type: 'string', description: 'e.g. "scaffold.complete", "tests.passed"' },
          },
        },
      },
      {
        name: 'list_templates',
        description: 'List all available templates (SDK × pattern)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'fsm_show',
        description: 'Return FSM as Mermaid state diagram',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  // ==========================================================================
  // CallTool
  // ==========================================================================
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;

    try {
      switch (name) {
        // --------------------------------------------------------------------------
        case 'create_project': {
          const spec = args as unknown as MCPSpec & { output?: string };
          const validation = validateMCPSpec(spec);
          if (!validation.ok) {
            return toToolResult({
              ok: false,
              error: validation.block?.reason,
              suggestions: validation.block?.suggestions,
            });
          }

          const outputRoot = spec.output ?? process.cwd();
          const scaffolder = new Scaffolder({ templatesRoot, outputRoot });
          const result = await scaffolder.generate(spec);
          return toToolResult(result);
        }

        // --------------------------------------------------------------------------
        case 'add_tool': {
          const { projectPath, tool } = args as { projectPath: string; tool: unknown };
          // Validar tool
          // Por ora apenas confirmar
          return toToolResult({ ok: true, projectPath, tool, message: 'tool added (placeholder)' });
        }

        // --------------------------------------------------------------------------
        case 'run_tests': {
          const { projectPath, suite = 'all' } = args as { projectPath: string; suite?: string };
          const absPath = resolve(projectPath);
          if (!existsSync(absPath)) {
            return toToolResult({ ok: false, error: `not found: ${absPath}` });
          }
          // detectar runner
          const cmd = existsSync(join(absPath, 'pyproject.toml'))
            ? ['pytest', '-v']
            : existsSync(join(absPath, 'package.json'))
              ? ['npm', 'test']
              : existsSync(join(absPath, 'go.mod'))
                ? ['go', 'test', './...']
                : existsSync(join(absPath, 'Cargo.toml'))
                  ? ['cargo', 'test']
                  : null;
          if (!cmd) {
            return toToolResult({ ok: false, error: 'unknown test runner' });
          }
          const { stdout, stderr } = await execFileAsync(cmd[0], cmd.slice(1), { cwd: absPath });
          return toToolResult({ ok: true, stdout, stderr, suite });
        }

        // --------------------------------------------------------------------------
        case 'validate_spec': {
          const { spec } = args as { spec: unknown };
          const result = validateMCPSpec(spec);
          return toToolResult(result);
        }

        // --------------------------------------------------------------------------
        case 'transition_state': {
          const { projectPath, event } = args as { projectPath: string; event: string };
          const fsm = await FSM.fromRepo(resolve(projectPath));
          const ctx = FSM.initialContext();
          try {
            const t = fsm.transition(ctx, event);
            return toToolResult({
              ok: true,
              from: ctx.current,
              to: t.to,
              workflow: t.action_workflow,
              advisor_required: t.advisor_required ?? false,
            });
          } catch (err) {
            return toToolResult({ ok: false, error: (err as Error).message });
          }
        }

        // --------------------------------------------------------------------------
        case 'list_templates': {
          const out: Record<string, string[]> = {};
          if (existsSync(templatesRoot)) {
            const sdks = await readdir(templatesRoot);
            for (const sdk of sdks) {
              const sdkDir = join(templatesRoot, sdk);
              const s = await stat(sdkDir);
              if (s.isDirectory()) {
                const patterns = (await readdir(sdkDir)).filter(async p => {
                  const ps = await stat(join(sdkDir, p));
                  return ps.isDirectory();
                });
                out[sdk] = patterns as unknown as string[];
              }
            }
          }
          return toToolResult({ ok: true, templates: out });
        }

        // --------------------------------------------------------------------------
        case 'fsm_show': {
          const fsm = await FSM.fromRepo(repoRoot);
          return toToolResult({ ok: true, mermaid: fsm.toMermaid() });
        }

        // --------------------------------------------------------------------------
        default:
          return toToolResult({ ok: false, error: `unknown tool: ${name}` });
      }
    } catch (err) {
      logger.error('tool execution failed', { tool: name, error: (err as Error).message });
      return toToolResult({ ok: false, error: (err as Error).message });
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Builder server started (stdio)');
}

// ============================================================================
// Helpers
// ============================================================================

function toToolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function findDefault(kind: 'templates' | 'repo'): string {
  // Em produção, basear-se em __dirname relativo
  const cwd = process.cwd();
  if (kind === 'templates') {
    return existsSync(join(cwd, 'templates')) ? join(cwd, 'templates') : join(cwd, '..', 'templates');
  }
  return existsSync(join(cwd, '.mcp')) ? cwd : join(cwd, '..');
}
