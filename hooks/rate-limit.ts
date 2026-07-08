/**
 * Hook customizado: rate-limit
 * Categoria: gate
 *
 * Limita invocações por janela de tempo (sliding window).
 * Útil para proteger contra abuso (LLM em loop infinito, etc.).
 *
 * Payload:
 *   { identifier: string, maxRequests: number, windowMs: number }
 *
 * Estado:
 *   Mantém em memória (Map). Em produção, substituir por Redis para
 *   distribuir entre múltiplos processos.
 */

import type { HookDescriptor, HookResult } from '../builder/src/types.js';

interface RateLimitEntry {
  timestamps: number[];
}

const store: Map<string, RateLimitEntry> = new Map();

export const rateLimitGate: HookDescriptor = {
  name: 'rate_limit',
  category: 'gate',
  description: 'Sliding window rate limiter (in-memory, single-process)',
  fn: async (_ctx, payload: {
    identifier: string;
    maxRequests: number;
    windowMs: number;
  }) => {
    const now = Date.now();
    const windowStart = now - payload.windowMs;

    // Get or create entry
    let entry = store.get(payload.identifier);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(payload.identifier, entry);
    }

    // Filter out timestamps outside window
    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);

    if (entry.timestamps.length >= payload.maxRequests) {
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + payload.windowMs - now;
      return block(
        `rate limit exceeded for "${payload.identifier}": ${entry.timestamps.length}/${payload.maxRequests} requests in last ${payload.windowMs}ms`,
        [
          `retry after ${Math.ceil(retryAfterMs / 1000)}s`,
          `increase maxRequests if this is expected load`,
        ],
      );
    }

    // Record this request
    entry.timestamps.push(now);

    return {
      ok: true,
      metrics: {
        'rate_limit.requests_in_window': entry.timestamps.length,
        'rate_limit.max_requests': payload.maxRequests,
        'rate_limit.window_ms': payload.windowMs,
        'rate_limit.remaining': payload.maxRequests - entry.timestamps.length,
      },
    };
  },
};

function block(reason: string, suggestions: string[]): HookResult {
  return {
    ok: false,
    block: {
      reason,
      suggestions,
      docs: 'docs/HOOKS.md#rate-limit',
    },
  };
}

/**
 * Limpa estado do rate limiter (para testes).
 */
export function _resetRateLimitStore(): void {
  store.clear();
}
