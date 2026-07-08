/**
 * Hook customizado: audit-log
 * Categoria: monitor
 *
 * Registra toda execução em log auditável (append-only) para compliance.
 * Pode ser enviado para sink externo (Splunk, ELK, Datadog) via webhook.
 *
 * Payload:
 *   { action: string, actor: string, resource: string, result: 'success' | 'failure', metadata?: Record<string, unknown> }
 *
 * Sink:
 *   - Local: $MCP_BUILDER_AUDIT_LOG (default: ~/.mcp-builder/audit.log)
 *   - Remoto: $MCP_BUILDER_AUDIT_SINK (webhook URL)
 */

import { appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import type { HookDescriptor } from '../builder/src/types.js';

export const auditLogMonitor: HookDescriptor = {
  name: 'audit_log',
  category: 'monitor',
  description: 'Append execution to audit log (compliance)',
  fn: async (_ctx, payload: {
    action: string;
    actor: string;
    resource: string;
    result: 'success' | 'failure';
    metadata?: Record<string, unknown>;
  }) => {
    const entry = {
      timestamp: new Date().toISOString(),
      action: payload.action,
      actor: payload.actor,
      resource: payload.resource,
      result: payload.result,
      metadata: payload.metadata ?? {},
    };

    const line = JSON.stringify(entry) + '\n';

    // Local append
    const logPath = process.env.MCP_BUILDER_AUDIT_LOG
      ?? join(homedir(), '.mcp-builder', 'audit.log');
    try {
      await mkdir(dirname(logPath), { recursive: true });
      await appendFile(logPath, line, 'utf8');
    } catch (err) {
      // não falha execução por erro de log
      console.warn(`[audit_log] failed to write local: ${(err as Error).message}`);
    }

    // Remote sink (webhook)
    const sinkUrl = process.env.MCP_BUILDER_AUDIT_SINK;
    if (sinkUrl) {
      try {
        await fetch(sinkUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: line,
        });
      } catch (err) {
        console.warn(`[audit_log] failed to send to sink: ${(err as Error).message}`);
      }
    }

    return {
      ok: true,
      metrics: {
        'audit_log.written': 1,
        'audit_log.result_success': payload.result === 'success' ? 1 : 0,
        'audit_log.result_failure': payload.result === 'failure' ? 1 : 0,
      },
    };
  },
};
