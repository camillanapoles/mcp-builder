# Changelog

Todos os mudanças notáveis deste projeto serão documentadas aqui.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0] — 2026-07-07

### Adicionado
- Blueprint arquitetural completo (`docs/BLUEPRINT.md`) com FSM, hooks, PDCA
- 4 ADRs documentando decisões fundamentais
- Builder core TS com 4 modos de invocação:
  - CLI (`commander`)
  - MCP server próprio (`@modelcontextprotocol/sdk`)
  - HTTP API (`fastify`)
  - GitHub Action adapter (`@actions/core`)
- FSM engine (determinística, lê `states.yaml` + `transitions.yaml`)
- Scaffolder (Handlebars, renderiza nomes de arquivos + conteúdo)
- 5 hooks canônicos:
  - `gate` (validate_spec, validate_template, check_prereqs, check_quota)
  - `trigger` (dispatch_action, dispatch_local, open_pr, notify_webhook)
  - `event` (routeEvent, subscribeEvent, EventBus pub/sub)
  - `monitor` (collectMetrics, validateDeterminism, streamLogs, notifyStakeholders)
  - `advisor` (checkCoverage, checkMutation, checkCompliance, checkContracts, signOff, collectFailure)
- Validator (JSON Schema + AJV + ajv-formats)
- Logger (pino com child meta)
- 4 templates SDK:
  - Python (stateless + event + factory) — completo
  - TypeScript (stateless) — completo
  - Go (stateless) — completo
  - Rust (stateless) — completo
- 6 workflows GitHub Actions materializando FSM:
  - `scaffold.yml` → draft → scaffolded
  - `test.yml` → scaffolded → tested (matrix)
  - `e2e.yml` → tested → validated
  - `release.yml` → validated → released (mutation gate)
  - `advisor-block.yml` → * → failed (abre issue)
  - `reset.yml` → failed → draft (via `/advisor-clear`)
- 5 camadas de testes:
  - Unit (vitest) — FSM, validator, hooks
  - Contract (JSON Schema + YAML validation)
  - E2E (via Actions matrix)
  - Property-based (fast-check — invariantes do FSM)
  - Mutation (stryker config, threshold 70%)
- Projeto exemplo (`examples/echo-stateless/`) — MCP server Python completo
- Estado determinístico (`.mcp/state/*.yaml`)
- Documentation: `GETTING_STARTED.md`, `BLUEPRINT.md`, 4 ADRs, `hooks/README.md`

### Características técnicas
- Builder: TypeScript 5.5+ ESNext, Node 20+, ESM
- Templates: Python 3.10+, TypeScript 5.5+, Go 1.22+, Rust stable
- FSM: declarativo em YAML, curingas suportados (`*` e `*.failed`)
- Hooks: registry plugin-based, short-circuit on block
- Determinismo: `hashProject()` + `validateDeterminism` hook
- Cobertura: gate de 80% no builder, 80% nos templates
- Mutation: gate de 70% no release

### Decisões arquiteturais (ADRs)
- [ADR-0001](docs/adr/0001-hybrid-ts-py-builder.md): Híbrido TS+Py
- [ADR-0002](docs/adr/0002-gitops-as-fsm.md): GitOps como FSM
- [ADR-0003](docs/adr/0003-hooks-bridge.md): Hooks como ponte agentic↔determinístico
- [ADR-0004](docs/adr/0004-five-test-layers.md): 5 camadas de testes

## [Unreleased]

### Planejado
- Templates event/factory para TypeScript, Go, Rust
- Plugin system de hooks customizados (load dinâmico)
- Dashboard web para visualizar FSM em tempo real
- Integração com LangSmith / Helicone para tracing
- Template "agent-tool" para MCPs que expõem agentes
- Suporte a MCP over HTTP (além de stdio)
- Streaming de responses (SSE) para tools longas
