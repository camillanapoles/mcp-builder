/**
 * GitHub Action adapter — Builder como action reutilizável.
 *
 * Uso em workflow:
 *
 *   - uses: mcp-builder/action@v1
 *     with:
 *       name: my-server
 *       sdk: python
 *       pattern: event
 *       tools: create_user,delete_user
 *
 * Esta action lê inputs, monta spec, gera projeto, e faz commit + push em
 * branch criada (`scaffold/${name}`).
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { Scaffolder } from '../scaffolder/index.js';
import { validateMCPSpec } from '../validator/index.js';
import { createLogger } from '../logger/index.js';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { MCPSpec, SDK, Pattern } from '../types.js';

const execFileAsync = promisify(execFile);

export async function runAction(): Promise<void> {
  const logger = createLogger();

  const name = core.getInput('name', { required: true });
  const sdk = core.getInput('sdk', { required: true }) as SDK;
  const pattern = core.getInput('pattern', { required: true }) as Pattern;
  const toolsRaw = core.getInput('tools') || 'default_tool';
  const output = core.getInput('output') || './generated';
  const commitMessage = core.getInput('commit-message') || `feat: scaffold ${name}`;

  const tools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const spec: MCPSpec = {
    name,
    description: `MCP server ${name} scaffolded by GitHub Action`,
    sdk,
    pattern,
    tools: tools.map(t => ({
      name: t,
      description: `${t} tool for ${name}`,
      inputSchema: { type: 'object', properties: {} },
    })),
    metadata: {
      author: github.context.actor,
      repository: github.context.payload.repository?.full_name,
    },
  };

  // Validar
  const validation = validateMCPSpec(spec);
  if (!validation.ok) {
    core.setFailed(`invalid spec: ${validation.block?.reason}`);
    return;
  }

  // Scaffold
  const templatesRoot = join(process.cwd(), 'templates');
  const scaffolder = new Scaffolder({
    templatesRoot,
    outputRoot: output,
    skipGit: true, // nós mesmos gerenciamos git abaixo
  });

  const result = await scaffolder.generate(spec);
  if (!result.ok) {
    core.setFailed(`scaffold failed: ${result.error}`);
    return;
  }

  core.setOutput('project-path', result.projectPath);
  core.setOutput('files-count', result.files.length);
  core.setOutput('files', result.files.join('\n'));

  // Commit em branch dedicada (scaffold/${name})
  const branch = `scaffold/${name}`;
  try {
    await execFileAsync('git', ['checkout', '-b', branch]);
    await execFileAsync('git', ['add', '.']);
    await execFileAsync('git', ['commit', '-m', commitMessage]);
    await execFileAsync('git', ['push', 'origin', branch]);
    core.setOutput('branch', branch);
    logger.info('committed to branch', { branch, files: result.files.length });
  } catch (err) {
    core.warning(`git operations failed: ${(err as Error).message}`);
  }
}

// Run if invoked as action (env GITHUB_ACTIONS=true)
if (process.env.GITHUB_ACTIONS === 'true') {
  runAction().catch(err => {
    core.setFailed(`action failed: ${err.message}`);
    // Note: process.exit(1) removed — core.setFailed() is sufficient for GitHub Actions
    // and calling process.exit() would kill test processes that import this module
  });
}
