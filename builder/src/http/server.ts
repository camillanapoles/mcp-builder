/**
 * HTTP API — Builder exposto como REST.
 *
 * Endpoints:
 *   POST /generate          → gera projeto a partir de spec JSON
 *   POST /validate          → valida spec
 *   GET  /templates         → lista templates
 *   GET  /fsm/mermaid       → retorna diagrama Mermaid
 *   POST /fsm/transition    → computa transição
 *   GET  /health            → healthcheck
 *
 * Auth: Bearer token (env MCP_BUILDER_TOKEN). Se ausente, sem auth (dev only).
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Scaffolder } from '../scaffolder/index.js';
import { FSM } from '../fsm/index.js';
import { validateMCPSpec } from '../validator/index.js';
import { createLogger } from '../logger/index.js';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { Logger } from '../types.js';

export interface HTTPServerOptions {
  port: number;
  host: string;
  logger?: Logger;
  templatesRoot?: string;
  repoRoot?: string;
}

export async function startHTTPServer(opts: HTTPServerOptions): Promise<void> {
  const logger = opts.logger ?? createLogger();
  const templatesRoot = opts.templatesRoot ?? join(process.cwd(), 'templates');
  const repoRoot = opts.repoRoot ?? process.cwd();

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: '*' });

  // Auth middleware (opcional)
  app.addHook('onRequest', async (req, reply) => {
    const token = process.env.MCP_BUILDER_TOKEN;
    if (token) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${token}`) {
        await reply.code(401).send({ ok: false, error: 'unauthorized' });
      }
    }
  });

  // ==========================================================================
  // POST /generate
  // ==========================================================================
  app.post('/generate', async (req, reply) => {
    const spec = req.body as Record<string, unknown>;
    const validation = validateMCPSpec(spec);
    if (!validation.ok) {
      return reply.code(400).send(validation);
    }

    const outputRoot = (req.query as { output?: string })?.output ?? process.cwd();
    const scaffolder = new Scaffolder({ templatesRoot, outputRoot });
    const result = await scaffolder.generate(spec as never);
    return reply.code(result.ok ? 201 : 400).send(result);
  });

  // ==========================================================================
  // POST /validate
  // ==========================================================================
  app.post('/validate', async (req, reply) => {
    const spec = req.body;
    const result = validateMCPSpec(spec);
    return reply.code(result.ok ? 200 : 400).send(result);
  });

  // ==========================================================================
  // GET /templates
  // ==========================================================================
  app.get('/templates', async () => {
    const { readdir, stat } = await import('node:fs/promises');
    const out: Record<string, string[]> = {};
    if (existsSync(templatesRoot)) {
      const sdks = await readdir(templatesRoot);
      for (const sdk of sdks) {
        const sdkDir = join(templatesRoot, sdk);
        const s = await stat(sdkDir);
        if (s.isDirectory()) {
          out[sdk] = (await readdir(sdkDir)).filter(async p => {
            const ps = await stat(join(sdkDir, p));
            return ps.isDirectory();
          }) as unknown as string[];
        }
      }
    }
    return { ok: true, templates: out };
  });

  // ==========================================================================
  // GET /fsm/mermaid
  // ==========================================================================
  app.get('/fsm/mermaid', async (_req, reply) => {
    try {
      const fsm = await FSM.fromRepo(repoRoot);
      return reply.type('text/plain').send(fsm.toMermaid());
    } catch (err) {
      return reply.code(500).send({ ok: false, error: (err as Error).message });
    }
  });

  // ==========================================================================
  // POST /fsm/transition
  // ==========================================================================
  app.post('/fsm/transition', async (req, reply) => {
    const { from, event } = req.body as { from: string; event: string };
    try {
      const fsm = await FSM.fromRepo(repoRoot);
      const ctx = { ...FSM.initialContext(), current: from };
      const t = fsm.transition(ctx, event);
      return { ok: true, from, to: t.to, workflow: t.action_workflow };
    } catch (err) {
      return reply.code(400).send({ ok: false, error: (err as Error).message });
    }
  });

  // ==========================================================================
  // GET /health
  // ==========================================================================
  app.get('/health', async () => ({ ok: true, ts: Date.now() }));

  // Start
  await app.listen({ port: opts.port, host: opts.host });
  logger.info(`HTTP API started on http://${opts.host}:${opts.port}`);
}
