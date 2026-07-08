# ADR-0004: 5 Camadas de Testes como Gate de Qualidade Ouro

**Status**: Aprovado • **Data**: 2026-07-07

## Contexto

Coverage de testes não garante qualidade — apenas que o código foi executado
durante os testes. Para "qualidade ouro mensurada" precisamos de múltiplas
camadas que validam **diferentes invariantes**:

- **Unit**: cada função faz o esperado
- **Contract**: integrações respeitam schema
- **E2E**: o sistema inteiro funciona end-to-end
- **Property**: invariantes estruturais (FSM nunca transita para estado inválido)
- **Mutation**: testes realmente capturam bugs (não só cobrem linhas)

## Decisão

Adotar **5 camadas de teste** obrigatórias, cada uma com ferramenta específica:

| Camada | TS | Py | Quando roda | Gate |
|---|---|---|---|---|
| Unit | vitest | pytest | cada commit | coverage ≥ 80% |
| Contract | json-schema + pact | pact-python | PR merge | 100% pass |
| E2E | Actions matrix | Actions matrix | PR + cron diário | 100% pass |
| Property | fast-check | hypothesis | nightly | 100% pass |
| Mutation | stryker | mutmut | release gate | score ≥ 70% |

### Camadas como workflows GitHub

```
test.yml           → unit + contract (rápido, < 5min)
e2e.yml            → matrix de SDKs (médio, ~15min)
property.yml       → nightly cron (longo, ~30min)
mutation.yml       → release gate (longo, ~1h)
```

### Mutation testing como gate de release

Antes de tag `v*.*.*`, `release.yml` invoca `mutation.yml`. Se mutation
score < 70%, o **advisor bloqueia** o release. Não há override automático;
humano precisa justificar via ADR.

## Consequências

### Positivas
- "Qualidade ouro" é mensurada, não subjetiva
- Mutation testing captura testes falsos-positivos (que não falham quando código muda)
- Property-based descobre edge cases que testes manuais não cobrem
- Contract tests garantem backward compatibility entre builder e templates
- Cada camada tem SLA claro — fácil priorizar falhas

### Negativas
- Tempo de CI: release full leva ~1h
- Custo de Actions minutes (especialmente mutation)
- Curva de aprendizado: property e mutation não são triviais
- Manutenção de 5 configurações de teste

### Mitigações
- Cache agressivo de dependências
- Mutation roda só em arquivos mudados (diff-based)
- Property roda nightly, não em cada PR
- Templates de teste prontos para cada padrão (event/factory/stateless)

## Invariantes por camada

### Unit
- `scaffolder.render(template, spec) → files` é determinístico
- `gate.validate(spec)` retorna `{ok: false, block}` para spec inválida
- `fsm.transition(from, event)` respeita `transitions.yaml`

### Contract
- Toda tool MCP gerada tem `name`, `description`, `inputSchema` válidos
- Toda resposta de tool tem `content[]` com `type` em `['text','image','resource']`
- `mcp.json` do template passa no JSON Schema oficial

### E2E
- `mcp-builder new --sdk python --pattern event` gera projeto que `pytest` passa
- MCP server gerado responde a `tools/list` com pelo menos 1 tool
- Workflow `scaffold.yml` completa em < 2min

### Property
- Para qualquer sequência de eventos válidos, FSM nunca atinge estado não-declarado
- Para qualquer spec válida, scaffolder gera exatamente os mesmos arquivos
- Para qualquer tool MCP, `inputSchema` é JSON Schema válido

### Mutation
- Mutar `if (coverage < 0.8)` para `if (coverage < 0.7)` faz teste falhar
- Mutar `return ok: true` para `return ok: false` faz teste falhar
- Mutar `transition.to` em `transitions.yaml` faz property test falhar

## Alternativas consideradas

1. **Só unit + E2E**: rejeitado — não captura invariantes estruturais nem qualidade de testes
2. **TDD estrito**: rejeitado — não escala para scaffolding de templates
3. **Só mutation**: rejeitado — caro demais para rodar a cada commit
4. **Sem gate de release**: rejeitado — volta ao problema de "qualidade subjetiva"

## Referências

- ADR-0001, ADR-0002, ADR-0003
- [Stryker Mutator](https://stryker-mutator.io)
- [fast-check](https://fast-check.dev/)
- [Hypothesis](https://hypothesis.readthedocs.io)
- [Pact](https://pact.io)
