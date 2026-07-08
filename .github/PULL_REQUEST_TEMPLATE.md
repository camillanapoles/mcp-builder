## Summary

<!-- Descreva brevemente o que este PR faz. Inclua link para issue relacionada se houver. -->

Closes #N

## Type of change

- [ ] **feat**: Nova funcionalidade (sem breaking change)
- [ ] **fix**: Bug fix (sem breaking change)
- [ ] **docs**: Apenas documentação
- [ ] **refactor**: Refatoração sem mudança de comportamento
- [ ] **perf**: Melhoria de performance
- [ ] **test**: Adição/correção de testes
- [ ] **chore**: Tarefas de manutenção (deps, configs, etc.)
- [ ] **breaking**: Breaking change (verifique CHANGELOG)

## Scope

Marque o que este PR afeta:

- [ ] `builder/` — Core TS (CLI, MCP server, HTTP API, Action)
- [ ] `templates/` — Templates Handlebars (4 SDKs × 3 padrões)
- [ ] `hooks/` — Hooks customizados (gate/trigger/event/monitor/advisor)
- [ ] `.github/workflows/` — Workflows GitHub Actions (FSM)
- [ ] `.mcp/` — Estado determinístico + blueprint
- [ ] `docs/` — Documentação (BLUEPRINT, ADRs, guias)
- [ ] `examples/` — Projetos exemplo
- [ ] `tests/` — Testes (unit/contract/e2e/property/mutation)

## Tests

Marque o que foi validado:

- [ ] **Unit tests** passando localmente (`cd builder && npm test`)
- [ ] **Property tests** passando (`cd builder && npm run test:property`)
- [ ] **Contract tests** passando (`cd builder && npm test -- tests/contract.test.ts`)
- [ ] **Example tests** passando (`cd examples/echo-stateless && pytest -v`)
- [ ] **Coverage** ≥ 80%
- [ ] **TypeScript** sem erros (`npm run typecheck`)
- [ ] **Lint** sem erros (`npm run lint`)

Se adicionou nova funcionalidade:
- [ ] Adicionei testes para cobri-la
- [ ] Atualizei CHANGELOG.md
- [ ] Atualizei documentação relevante

## Blueprint changes

Se este PR modifica `blueprint.yaml`:

- [ ] Validei com `mcp-builder blueprint-validate path/to/blueprint.yaml`
- [ ] Justifiquei mudanças (em Summary)

## FSM transitions

Se este PR adiciona/modifica estados ou transições do FSM:

- [ ] Atualizei `.mcp/state/states.yaml`
- [ ] Atualizei `.mcp/state/transitions.yaml`
- [ ] Atualizei workflow correspondente em `.github/workflows/`
- [ ] Gerei novo diagrama Mermaid com `mcp-builder fsm-show`

## Hooks changes

Se este PR adiciona/modifica hooks:

- [ ] Implementei em `hooks/` ou `builder/src/hooks/`
- [ ] Adicionei testes em `hooks/__tests__/` ou `builder/tests/hooks.test.ts`
- [ ] Documentei em `docs/HOOKS.md`
- [ ] Categoria correta: `gate` | `trigger` | `event` | `monitor` | `advisor`

## Checklist final

- [ ] Meu código segue o estilo do projeto (sem lint errors)
- [ ] Commits seguem [Conventional Commits](https://www.conventionalcommits.org)
- [ ] Nenhum `TODO`/`FIXME` foi deixado sem justificativa
- [ ] Self-review feito
- [ ] Não comitei secrets (verifique `.env`, tokens, keys)

## Notas adicionais

<!-- Qualquer contexto extra para reviewers: decisões de design, alternativas consideradas, etc. -->

## ADRs

Se este PR introduz decisão arquitetural significativa:
- [ ] Criei novo ADR em `docs/adr/NNNN-title.md` (use próximo número disponível)
- [ ] Linkei ADRs relacionados
