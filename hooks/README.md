# Hooks System — Plugins Customizados

Os 5 hooks canônicos (`gate`, `trigger`, `event`, `monitor`, `advisor`)
são built-in em `builder/src/hooks/`. Este diretório (`/hooks/`) é onde
você coloca **plugins customizados** que estendem o comportamento.

## Estrutura de um plugin

Cada plugin é um módulo TS que exporta um `HookDescriptor`:

```typescript
// hooks/my-cost-limit.ts
import type { HookDescriptor } from '../builder/src/types.js';

export const costLimitGate: HookDescriptor = {
  name: 'cost_limit',
  category: 'gate',
  description: 'Blocks if estimated LLM cost exceeds budget',
  fn: async (ctx, payload: { estimatedCost: number; budget: number }) => {
    if (payload.estimatedCost > payload.budget) {
      return {
        ok: false,
        block: {
          reason: `estimated cost $${payload.estimatedCost} exceeds budget $${payload.budget}`,
          suggestions: ['reduce tool count', 'use cheaper model'],
        },
      };
    }
    return { ok: true, metrics: { estimated_cost: payload.estimatedCost } };
  },
};
```

## Registrando plugins

Crie `hooks/index.ts` que exporta todos os plugins:

```typescript
// hooks/index.ts
import { costLimitGate } from './my-cost-limit.js';
import { auditLogMonitor } from './my-audit-log.js';

export const customHooks = [costLimitGate, auditLogMonitor];
```

O Builder carrega automaticamente este arquivo (se existir) quando
inicializa o `HookRegistry`.

## Categorias disponíveis

| Categoria | Quando roda | Pode bloquear? |
|---|---|---|
| `gate` | Pré-execução | ✅ Sim |
| `trigger` | Após gate passar | ❌ Não (apenas dispara) |
| `event` | Quando evento chega | ❌ Não (apenas roteia) |
| `monitor` | Durante + pós-execução | ❌ Não (apenas observa) |
| `advisor` | Pós-execução | ✅ Sim (quality gate) |

## Exemplos de plugins úteis

### Gate: rate limiting
```typescript
export const rateLimitGate: HookDescriptor = {
  name: 'rate_limit',
  category: 'gate',
  description: 'Limits invocations per minute',
  fn: async (_ctx, payload: { count: number; max: number }) => {
    return payload.count > payload.max
      ? { ok: false, block: { reason: 'rate limit', suggestions: ['try later'] } }
      : { ok: true };
  },
};
```

### Monitor: métricas Prometheus
```typescript
export const prometheusMonitor: HookDescriptor = {
  name: 'prometheus',
  category: 'monitor',
  description: 'Exports metrics to Prometheus pushgateway',
  fn: async (_ctx, payload: { metric: string; value: number }) => {
    await fetch(process.env.PROMETHEUS_PUSHGATEWAY!, {
      method: 'POST',
      body: `${payload.metric} ${payload.value}`,
    });
    return { ok: true };
  },
};
```

### Advisor: dependabot-style check
```typescript
export const dependencyAdvisor: HookDescriptor = {
  name: 'dependency_check',
  category: 'advisor',
  description: 'Blocks release if known vulnerabilities found',
  fn: async (_ctx, payload: { vulnerabilities: string[] }) => {
    return payload.vulnerabilities.length > 0
      ? { ok: false, block: { reason: `${payload.vulnerabilities.length} vulnerabilities`, suggestions: ['run npm audit fix'] } }
      : { ok: true };
  },
};
```

## Testando plugins

Cada plugin deve ter testes unit + property em `hooks/__tests__/`:

```typescript
// hooks/__tests__/my-cost-limit.test.ts
import { describe, it, expect } from 'vitest';
import { costLimitGate } from '../my-cost-limit.js';

describe('costLimitGate', () => {
  it('blocks when cost exceeds budget', async () => {
    const result = await costLimitGate.fn({} as never, { estimatedCost: 10, budget: 5 });
    expect(result.ok).toBe(false);
    expect(result.block?.reason).toContain('exceeds budget');
  });

  it('allows when cost within budget', async () => {
    const result = await costLimitGate.fn({} as never, { estimatedCost: 3, budget: 5 });
    expect(result.ok).toBe(true);
  });
});
```

## Convenções

- Nome do plugin: `snake_case` (ex: `cost_limit`, `rate_limit`)
- Um arquivo por plugin
- Sempre tipar payload (TypeScript)
- Sempre retornar `metrics` quando relevante
- Sempre incluir `suggestions` acionáveis ao bloquear
- Documentar no `description` o que o plugin faz
