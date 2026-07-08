/**
 * MONITOR hooks — observabilidade durante e após execução.
 *
 * Padrão PDCA: Check.
 *
 * Monitors built-in:
 *   - collect_metrics      → tempo, contagem, sucesso/falha
 *   - validate_determinism → mesma spec → mesmo output (hash)
 *   - stream_logs          → logs estruturados para sink externo
 *   - notify_stakeholders  → Slack/email/etc
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { Hook } from '../types.js';

export const collectMetrics: Hook<{ name: string; durationMs: number; success: boolean; extra?: Record<string, number> }> =
  async (_ctx, payload) => {
    const metrics = {
      [`metric.${payload.name}.duration_ms`]: payload.durationMs,
      [`metric.${payload.name}.success`]: payload.success ? 1 : 0,
      ...Object.fromEntries(
        Object.entries(payload.extra ?? {}).map(([k, v]) => [`metric.${payload.name}.${k}`, v]),
      ),
    };
    return { ok: true, metrics };
  };

/**
 * Determinismo: hasheia todos arquivos de um diretório recursivamente.
 * Mesmo conteúdo → mesmo hash. Usado para validar que mesma spec gera mesmo output.
 */
export async function hashProject(root: string): Promise<string> {
  const hash = createHash('sha256');
  const entries = await collectFiles(root);
  entries.sort(); // ordem determinística

  for (const file of entries) {
    const content = await readFile(file, 'utf8');
    const rel = relative(root, file);
    hash.update(`${rel}\0${content}\0`);
  }
  return hash.digest('hex');
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '__pycache__' || e.name === 'target') continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...await collectFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

export const validateDeterminism: Hook<{ expectedHash: string; projectPath: string }> =
  async (_ctx, payload) => {
    const actualHash = await hashProject(payload.projectPath);
    if (actualHash !== payload.expectedHash) {
      return {
        ok: false,
        block: {
          reason: `determinism violated: expected ${payload.expectedHash.slice(0, 8)}, got ${actualHash.slice(0, 8)}`,
          suggestions: ['check for non-deterministic file ordering or timestamps'],
        },
        metrics: { determinism_match: 0 },
      };
    }
    return { ok: true, metrics: { determinism_match: 1 } };
  };

export const streamLogs: Hook<{ level: string; message: string; meta?: Record<string, unknown> }> =
  async (ctx, payload) => {
    const sink = process.env.MCP_BUILDER_LOG_SINK;
    if (!sink) {
      // sink default: stdout
      ctx.logger[payload.level as 'info' | 'warn' | 'error']?.(payload.message, payload.meta);
      return { ok: true };
    }
    try {
      await fetch(sink, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: payload.level, message: payload.message, meta: payload.meta, ts: Date.now() }),
      });
    } catch (err) {
      ctx.logger.warn('log sink failed', { error: (err as Error).message });
    }
    return { ok: true };
  };

export const notifyStakeholders: Hook<{ channel: string; message: string; mentions?: string[] }> =
  async (_ctx, payload) => {
    // Em produção: integrar com Slack, Discord, email
    // Aqui: log apenas
    return {
      ok: true,
      data: { notified: payload.channel, message: payload.message },
    };
  };
