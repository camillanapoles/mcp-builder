/**
 * GATE hooks — validam PRÉ-execução. Se qualquer gate falha, execução aborta.
 *
 * Padrão PDCA: Plan.
 *
 * Gates built-in:
 *   - validate_spec      → JSON Schema da MCPSpec
 *   - validate_template  → template existe para o sdk×pattern solicitado
 *   - check_prereqs      → dependências (node, python, go, rust) instaladas
 *   - check_quota        → limite de projetos por dia (anti-abuso)
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Hook, HookContext } from '../types.js';
import { validateMCPSpec } from '../validator/index.js';

const execFileAsync = promisify(execFile);

export const validateSpec: Hook<unknown> = async (_ctx: HookContext, payload: unknown) => {
  const r = validateMCPSpec(payload);
  if (r.ok) return { ok: true };
  return {
    ok: false,
    block: r.block,
  };
};

export const validateTemplate: Hook<{ sdk: string; pattern: string; templatesRoot: string }> =
  async (_ctx, payload) => {
    const dir = join(payload.templatesRoot, `${payload.sdk}-sdk`, payload.pattern);
    if (!existsSync(dir)) {
      return {
        ok: false,
        block: {
          reason: `template not found: ${payload.sdk}/${payload.pattern}`,
          suggestions: [
            `check available templates at ${payload.templatesRoot}`,
            `try one of: python-sdk/stateless, typescript-sdk/event, go-sdk/factory`,
          ],
          docs: 'docs/TEMPLATES.md',
        },
      };
    }
    return { ok: true };
  };

export const checkPrereqs: Hook<{ sdks: string[] }> = async (_ctx, payload) => {
  const checks: Record<string, (v: string) => boolean> = {
    python: v => /^Python 3\.(1[0-9]|[2-9][0-9])\./.test(v),
    typescript: v => /^v(2[0-9]|[3-9][0-9])\./.test(v),
    go: v => /^go version go1\.(2[0-9]|[3-9][0-9])/.test(v),
    rust: v => /^rustc 1\.(7[0-9]|[8-9][0-9])/.test(v),
  };
  const commands: Record<string, [string, string[]]> = {
    python: ['python3', ['--version']],
    typescript: ['node', ['--version']],
    go: ['go', ['version']],
    rust: ['rustc', ['--version']],
  };

  for (const sdk of payload.sdks) {
    const [cmd, args] = commands[sdk] ?? [];
    if (!cmd) {
      return {
        ok: false,
        block: { reason: `unknown sdk: ${sdk}`, suggestions: ['use one of: python, typescript, go, rust'] },
      };
    }
    try {
      const { stdout } = await execFileAsync(cmd, args);
      if (!checks[sdk](stdout.trim())) {
        return {
          ok: false,
          block: {
            reason: `${sdk} version too old: ${stdout.trim()}`,
            suggestions: [`upgrade ${sdk} to latest`],
          },
        };
      }
    } catch {
      return {
        ok: false,
        block: {
          reason: `${sdk} not installed`,
          suggestions: [`install ${sdk} runtime`],
        },
      };
    }
  }
  return { ok: true };
};

export const checkQuota: Hook<{ projectCount: number; maxPerDay: number }> =
  async (_ctx, payload) => {
    if (payload.projectCount >= payload.maxPerDay) {
      return {
        ok: false,
        block: {
          reason: `quota exceeded: ${payload.projectCount}/${payload.maxPerDay} projects today`,
          suggestions: ['try again tomorrow', 'request quota increase via issue'],
        },
      };
    }
    return { ok: true, metrics: { projects_today: payload.projectCount } };
  };
