# ADR-0003: Hooks System como Ponte Agentic ↔ Determinístico

**Status**: Aprovado • **Data**: 2026-07-07

## Contexto

Temos dois mundos:
- **Agentic** (LLM + tools): flexível, criativo, não-determinístico por design
- **Determinístico** (GitHub Actions + FSM): auditável, reproduzível, rígido

Sem uma ponte explícita, o LLM pode:
- Chamar tool fora de ordem válida (ex: publicar antes de testar)
- Receber resultado mas não saber se está conforme spec
- Não ter observabilidade do que aconteceu
- Continuar executando após falha silenciosa

## Decisão

Implementar **5 hooks canônicos** que formam um pipeline obrigatório:

```
gate → trigger → event → [GitHub Action] → monitor → advisor
```

| Hook | Papel no PDCA | Falha? |
|---|---|---|
| **gate** | Plan — valida pré-condições | Bloqueia |
| **trigger** | Do — dispara evento | Aborta |
| **event** | Do — roteia pub/sub | Apenas roteia |
| **monitor** | Check — coleta métricas | Observabilidade |
| **advisor** | Act — valida conformidade | Bloqueia + sugere |

### Contrato unificado

Todos hooks implementam:
```typescript
type Hook<T> = (ctx: HookContext, payload: T) => Promise<HookResult>;
```

### Registry plugin-based

Agentes carregam apenas hooks necessários. Claude Code em modo silencioso pode
pular `monitor`. Modo strict carrega os 5.

## Consequências

### Positivas
- Separação clara de responsabilidades
- Cada hook é testável isoladamente (unit + property)
- Plugins de terceiros podem estender (ex: hook `cost-limit` que bloqueia
  se custo de LLM > $X)
- Advisor centraliza "qualidade ouro" — fácil de auditar

### Negativas
- Overhead de latência (~5-10ms por hook)
- Complexidade: dev precisa entender 5 hooks
- Curva de aprendizado para plugins customizados

### Mitigações
- Hooks padrão vêm pré-configurados (zero-config para casos comuns)
- Modo `--skip-hooks=monitor,advisor` para dev rápido
- Documentação + examples por hook

## Padrões de hook

### Gate (pré-execução)
```typescript
const validateSpec: Hook<MCPSpec> = async (ctx, spec) => {
  const valid = ajv.validate(specSchema, spec);
  return valid
    ? { ok: true }
    : { ok: false, block: { reason: 'invalid spec', suggestions: [...] } };
};
```

### Advisor (pós-execução)
```typescript
const checkCoverage: Hook<TestResult> = async (ctx, result) => {
  if (result.coverage < 0.8) {
    return {
      ok: false,
      block: {
        reason: `coverage ${result.coverage} < 0.8`,
        suggestions: ['add tests for src/handlers/user.ts']
      }
    };
  }
  return { ok: true, metrics: { coverage: result.coverage } };
};
```

## Alternativas consideradas

1. **Middleware chain (Express-like)**: rejeitado — sem separação gate/trigger/monitor
2. **Decorators Python**: rejeitado — acopla a Py, hooks são cross-lang
3. **AOP (aspect-oriented)**: rejeitado — complexo demais para o ganho
4. **Sem hooks (LLM decide tudo)**: rejeitado — volta ao problema original

## Referências

- ADR-0001, ADR-0002
- [Hook pattern](https://refactoring.guru/design-patterns/observer)
- [PDCA cycle](https://asq.org/quality-resources/pdca-cycle)
