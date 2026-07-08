# ADR-0002: GitOps como Máquina de Estados Finita (FSM)

**Status**: Aprovado • **Data**: 2026-07-07

## Contexto

MCP servers atuais misturam estado em:
- Memória do LLM (volátil)
- Variáveis de ambiente de Actions (não-reproduzíveis)
- Issues/PRs (semi-estruturados)

Resultado: impossível auditar, impossível dar replay, impossível ralizar
rollback determinístico.

## Decisão

Modelar o ciclo de vida de cada MCP server como uma **FSM formal** (S, Σ, δ, s₀, F)
materializada em:

- **S** (estados): YAML em `.mcp/state/states.yaml` — versionado
- **Σ** (eventos): labels de Actions, tags git, issue comments
- **δ** (transições): YAML em `.mcp/state/transitions.yaml` — versionado
- **s₀** (inicial): `draft`
- **F** (finais): `released`, `archived`

Cada **estado** = um **workflow file** em `.github/workflows/`.
Cada **transição** = um `workflow_run` trigger.

**Passagem de payload entre estados**: artifacts do GitHub (`upload-artifact`
+ `download-artifact`). Nada de env vars mágicas.

## Consequências

### Positivas
- `git log` = event sourcing completo
- Replay: `act` ou `workflow_dispatch` com mesmos artifacts → mesmo resultado
- Auditoria: cada transição é um commit + workflow run
- Advisor pode bloquear transições simplesmente não disparando o próximo workflow
- Visualização: `mermaid stateDiagram` gerado a partir de `states.yaml`

### Negativas
- Verboso: 6+ workflows para um ciclo de vida simples
- Latência: cada transição é um workflow run (~30s-2min)
- Custo de Actions minutes maior

### Mitigações
- Workflows reutilizáveis (`workflow_call`) reduzem duplicação
- Cache agressivo (`actions/cache`) reduz tempo de setup
- Transições "rápidas" (draft→scaffolded) podem rodar em self-hosted runner
- Para dev local, `act` + Docker substitui Actions

## Padrões de transição

### Transição normal
```yaml
- from: tested
  to: validated
  event: tests.passed
  action_workflow: e2e.yml
  advisor_required: true   # advisor precisa aprovar
```

### Transição de falha (curinga)
```yaml
- from: "*"
  to: failed
  event: "*.failed"
  action_workflow: advisor-block.yml
```

### Transição de recuperação
```yaml
- from: failed
  to: draft
  event: advisor.cleared
  action_workflow: reset.yml
```

## Alternativas consideradas

1. **Branches por estado** (git-flow estendido): rejeitado — merge noise, difícil de visualizar
2. **Tags semver**: rejeitado — não captura estado intermediário
3. **Issues + labels**: rejeitado — não-determinístico (humano move labels)
4. **SQLite externo**: rejeitado — quebra "repo as source of truth"

## Referências

- ADR-0001 (Híbrido TS+Py)
- [GitHub Actions: workflow_run](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run)
- [Event Sourcing pattern](https://martinfowler.com/eaaDev/EventSourcing.html)
