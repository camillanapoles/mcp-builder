# MCP Builder

> **Plugin CLI para agentes (Claude Code, Codex, Cursor) que gera, valida e opera MCP servers com determinismo GitOps.**

[![FSM: GitOps](https://img.shields.io/badge/FSM-GitOps-blue)](.mcp/state/states.yaml)
[![Builder: TS+Py](https://img.shields.io/badge/builder-TS%2BPy-orange)](builder/)
[![Templates: 4 SDKs](https://img.shields.io/badge/templates-4%20SDKs-green)](templates/)
[![Tests: 5 layers](https://img.shields.io/badge/tests-5%20layers-red)](tests/)

---

## O que é

Um **MCP Builder** que combina:

- **Contexto agentic** (LLM + tools + hooks) → flexibilidade
- **Determinismo de workflow** (GitHub Actions + GitOps-as-FSM) → auditabilidade
- **Hooks system** (gate / trigger / event / monitor / advisor) → coerência
- **Templates** (Python / TypeScript / Go / Rust × event / factory / stateless) → padrão

O resultado: cada MCP server gerado é uma **máquina de estados finita**
auditável, com loop PDCA materializado em GitHub Actions.

## Instalação rápida

```bash
# Como CLI
npx @mcp-builder/cli new my-server --sdk python --pattern event

# Como MCP server (carregar no Claude Code / Cursor)
# ~/.config/claude-code/mcp.json
{
  "mcpServers": {
    "mcp-builder": {
      "command": "npx",
      "args": ["@mcp-builder/cli", "serve"]
    }
  }
}

# Como GitHub Action
- uses: mcp-builder/action@v1
  with:
    name: my-server
    sdk: python
    pattern: event

# Como HTTP API
curl -X POST http://localhost:3000/generate \
  -d '{"name":"my-server","sdk":"python","pattern":"event"}'
```

## Documentação

| Documento | O que cobre |
|---|---|
| [docs/BLUEPRINT.md](docs/BLUEPRINT.md) | Arquitetura mestre, FSM, hooks, PDCA |
| [docs/adr/](docs/adr/) | Decisões arquiteturais (ADRs) |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Primeiro MCP em 5 min |
| [docs/HOOKS.md](docs/HOOKS.md) | Como escrever hooks customizados |
| [docs/TEMPLATES.md](docs/TEMPLATES.md) | Como criar novo template |

## Estrutura

```
mcp-builder/
├── builder/          # TS core — CLI, MCP server, HTTP, Action
├── hooks/            # gate / trigger / event / monitor / advisor
├── templates/        # 4 SDKs × 3 padrões
├── .github/workflows/# FSM materializado em Actions
├── .mcp/             # estado determinístico (YAML)
├── docs/             # blueprint + ADRs
└── tests/            # 5 camadas de teste
```

## Loop PDCA

```
Plan  → gate valida spec, schema, prereqs
Do    → trigger dispara evento, Action executa
Check → monitor coleta métricas, roda contract tests
Act   → advisor bloqueia não-conforme ou transiciona estado
```

Cada volta = uma execução de workflow. `git log` = event sourcing.

## Status

v1.0.0 — Blueprint implementado, 4 templates, 5 camadas de testes, exemplo
validado end-to-end. Veja [CHANGELOG](CHANGELOG.md).

## Licença

MIT.
