/**
 * Hook customizado: cost-limit
 * Categoria: gate
 *
 * Bloqueia execução se custo estimado de LLM exceder orçamento.
 * Útil para evitar surpresas em faturamento de API.
 *
 * Payload:
 *   { estimatedCost: number, budget: number, currency?: string }
 *
 * Metrics emitidos:
 *   metric.cost_limit.estimated_cost
 *   metric.cost_limit.budget
 *   metric.cost_limit.utilization (0-1)
 */

import type { HookDescriptor } from '../builder/src/types.js';

export const costLimitGate: HookDescriptor = {
  name: 'cost_limit',
  category: 'gate',
  description: 'Blocks if estimated LLM cost exceeds budget',
  fn: async (_ctx, payload: { estimatedCost: number; budget: number; currency?: string }) => {
    const utilization = payload.budget > 0 ? payload.estimatedCost / payload.budget : 1;

    if (payload.estimatedCost > payload.budget) {
      return {
        ok: false,
        block: {
          reason: `estimated cost ${payload.currency ?? '$'}${payload.estimatedCost.toFixed(4)} exceeds budget ${payload.currency ?? '$'}${payload.budget.toFixed(4)} (${(utilization * 100).toFixed(1)}% utilization)`,
          suggestions: [
            'reduce the number of tools in the spec',
            'use a cheaper model (e.g. haiku instead of sonnet)',
            'batch multiple operations into a single tool call',
            'request budget increase via issue',
          ],
          docs: 'docs/HOOKS.md#cost-limit',
        },
        metrics: {
          'cost_limit.estimated_cost': payload.estimatedCost,
          'cost_limit.budget': payload.budget,
          'cost_limit.utilization': utilization,
        },
      };
    }

    return {
      ok: true,
      metrics: {
        'cost_limit.estimated_cost': payload.estimatedCost,
        'cost_limit.budget': payload.budget,
        'cost_limit.utilization': utilization,
      },
    };
  },
};
