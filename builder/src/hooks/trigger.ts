/**
 * TRIGGER hooks — disparam eventos após gate passar.
 *
 * Padrão PDCA: Do.
 *
 * Triggers built-in:
 *   - dispatch_action    → workflow_dispatch no GitHub Actions
 *   - dispatch_local     → executa comando local (dev)
 *   - open_pr            → cria PR com mudanças
 *   - notify_webhook     → POST para URL externa
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Hook } from '../types.js';

const execFileAsync = promisify(execFile);

export const dispatchAction: Hook<{
  workflow: string;
  ref: string;
  inputs?: Record<string, string>;
}> = async (ctx, payload) => {
  // Em produção: usar @actions/github ou fetch para GitHub API
  // Aqui: simulação para testes
  ctx.logger.info('dispatching workflow', { workflow: payload.workflow, ref: payload.ref });
  // mock: retornar success
  return {
    ok: true,
    data: { workflow_run_id: Math.floor(Math.random() * 100000), html_url: `https://github.com/${ctx.git.repo}/actions` },
  };
};

export const dispatchLocal: Hook<{ command: string; args?: string[]; cwd?: string }> =
  async (_ctx, payload) => {
    try {
      const { stdout, stderr } = await execFileAsync(payload.command, payload.args ?? [], {
        cwd: payload.cwd ?? process.cwd(),
      });
      return { ok: true, data: { stdout, stderr } };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      return {
        ok: false,
        block: {
          reason: `command failed: ${payload.command}`,
          suggestions: [e.stderr ?? e.message],
        },
      };
    }
  };

export const openPR: Hook<{
  branch: string;
  title: string;
  body?: string;
}> = async (ctx, payload) => {
  ctx.logger.info('opening PR', { branch: payload.branch, title: payload.title });
  // Em produção: octokit.pulls.create
  return {
    ok: true,
    data: { number: Math.floor(Math.random() * 1000), url: `https://github.com/${ctx.git.repo}/pulls` },
  };
};

export const notifyWebhook: Hook<{ url: string; event: string; data?: unknown }> =
  async (_ctx, payload) => {
    try {
      const resp = await fetch(payload.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: payload.event, data: payload.data }),
      });
      if (!resp.ok) {
        return {
          ok: false,
          block: { reason: `webhook returned ${resp.status}`, suggestions: ['check webhook URL'] },
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        block: { reason: `webhook failed: ${(err as Error).message}`, suggestions: [] },
      };
    }
  };
