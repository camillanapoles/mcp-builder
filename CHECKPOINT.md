# Checkpoint — MCP Builder

Última atualização: 2026-07-08

---

## v1.1.0 — Metodologia Blueprint + matriz 4×3 + hooks customizados + mutation testing

### Estado
- **Tag git**: `v1.1.0`
- **Commit**: `7b19c5f feat: v1.1.0 — blueprint methodology + 4x3 templates + custom hooks + mutation testing`
- **Status**: ✅ Incremento validado end-to-end
- **Testes**: 123/123 builder tests + 38/38 example tests passing
- **Mutation score**: 62.60% no validator (acima do break threshold 50%)

### Incrementos v1.1.0

**Metodologia Blueprint (Devin-style, desvinculada do Devin)**:
- Módulo `builder/src/blueprint/` (parser + executor + types)
- Seções suportadas: `initialize`, `maintenance`, `knowledge`, `post-build`, `clone`
- 31 testes cobrindo parser + executor (multi-document, ENVRC propagation, post-build scope, secrets)
- 3 subcomandos CLI: `blueprint-validate`, `blueprint-run`, `blueprint-knowledge`
- 12 `blueprint.yaml.hbs` (1 por template SDK×pattern) + 1 raiz + 1 exemplo
- Documentação `docs/BLUEPRINT-METHODOLOGY.md` (12 seções, 400+ linhas)

**Matriz 4×3 completa** (12 templates):
- Python: stateless + event + factory (completos com testes)
- TypeScript: stateless + event + factory (completos)
- Go: stateless + event + factory (completos)
- Rust: stateless + event + factory (completos)

**5 hooks customizados** em `hooks/`:
- `cost-limit.ts` (gate): bloqueia se custo LLM exceder orçamento
- `audit-log.ts` (monitor): append-only audit log + webhook sink
- `dependency-vulns.ts` (advisor): bloqueia release com vulns (critical/high/strict-medium)
- `rate-limit.ts` (gate): sliding window rate limiter (in-memory)
- `prompt-injection-detector.ts` (gate): detecta 7 padrões de prompt injection
- 27 testes cobrindo os 5 hooks

**Mutation testing**:
- Stryker configurado + executado no `validator/index.ts`
- Resultado: 62.60% score (77 killed, 37 survived, 9 no coverage)
- Report HTML em `builder/reports/mutation/mutation.html`

**GitHub repo setup**:
- `.github/PULL_REQUEST_TEMPLATE.md` — template completo com checklist
- `.github/REPO-SETUP.md` — guia de branch protection, secrets, workflows, Dependabot, CODEOWNERS
- `.mcp/CLAUDE-CODE-SETUP.md` — instruções para Claude Code / Cursor / Cline
- `.mcp/claude-code-config.example.json` — config pronta para copiar

### Métricas atualizadas
| Métrica | v1.0.0 | v1.1.0 | Δ |
|---|---|---|---|
| Arquivos no monorepo | 124 | 165 | +41 |
| Templates Handlebars | 51 (6 slots) | 78 (12 slots preenchidos) | +27 |
| Workflows YAML | 6 | 6 | — |
| Builder tests passing | 65/65 | 123/123 | +58 |
| Example tests passing | 0 | 38/38 | +38 |
| Custom hooks | 0 | 5 | +5 |
| ADRs | 4 | 4 | — |
| Builder source files | 16 | 20 | +4 |
| Mutation score (validator) | n/a | 62.60% | novo |
| Blueprint YAML files | 0 | 14 (12 templates + raiz + exemplo) | +14 |

### Como restaurar
```bash
cd /home/z/my-project/mcp-builder
git checkout v1.1.0
```

---

## v1.0.0 — Blueprint arquitetural completo (checkpoint inicial)

### Estado
- **Tag git**: `v1.0.0`
- **Commit**: `7b037cb feat: checkpoint v1.0.0 — MCP Builder blueprint completo`
- **Status**: ✅ Funcional end-to-end
- **Testes**: 65/65 passing (unit + property + contract)
- **SDKs validados via CLI real**: Python, TypeScript, Go, Rust

### Conteúdo entregue
- Builder core TS (`builder/src/`, 16 arquivos)
- 4 templates SDK (Python 3 padrões, TS/Go/Rust stateless)
- 5 hooks canônicos (gate/trigger/event/monitor/advisor) com 16+ implementações built-in
- 6 workflows GitHub Actions (FSM GitOps completo: scaffold→test→e2e→release, advisor-block, reset)
- FSM engine determinística (states.yaml + transitions.yaml)
- 4 ADRs documentando decisões
- Exemplo `echo-stateless` pronto para `pip install + pytest`
- Stryker config (mutation threshold 70%)
- Documentação: BLUEPRINT.md, GETTING_STARTED.md, HOOKS.md, TEMPLATES.md

---

## Próximas fases (incremental)

### v1.2.0 — Differential builds + workspaces
- [ ] Differential builds (estilo Devin) — só re-executa workspaces que mudaram
- [ ] Workspaces para monorepos (blueprint por subdiretório)
- [ ] Integração com act (rodar workflows localmente)
- [ ] Cache de snapshots baseado em `hashBlueprint()`

### v1.3.0 — UI + dashboards
- [ ] Dashboard web para visualizar FSM em tempo real
- [ ] Visualizador de blueprints no navegador
- [ ] Streaming de logs de workflow runs
- [ ] Integração com LangSmith / Helicone para tracing

### v2.0.0 — Features avançadas
- Blueprints como MCP resources (surfaced ao agente em runtime)
- Sync via API REST (estilo Devin) — opcional
- Templates "agent-tool" para MCPs que expõem agentes
- Suporte a MCP over HTTP (além de stdio)
- Streaming de responses (SSE) para tools longas

### Backlog (sem data)
- Mutation testing em todos os módulos do builder (não só validator)
- Templates event/factory com testes completos (TS/Go/Rust)
- Hooks adicionais: license-check, sbom-generator, sigstore-sign
- Integração com Sigstore para assinatura de releases
- Suporte a MCP server com SSE (Server-Sent Events)
- Multi-arch builds para Go/Rust (linux/amd64, linux/arm64, darwin/arm64)

---

## Como restaurar checkpoints

```bash
cd /home/z/my-project/mcp-builder

# Listar tags
git tag -l
# v1.0.0
# v1.1.0

# Restaurar checkpoint específico
git checkout v1.1.0  # estado atual
git checkout v1.0.0  # estado inicial

# Ver diff entre versões
git log --oneline v1.0.0..v1.1.0
git diff v1.0.0..v1.1.0 --stat
```
