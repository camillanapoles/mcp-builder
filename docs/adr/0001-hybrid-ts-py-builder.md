# ADR-0001: Builder Híbrido TypeScript + Python

**Status**: Aprovado • **Data**: 2026-07-07 • **Decisor**: arquitetura

## Contexto

O MCP Builder precisa:
1. Orquestrar GitHub Actions (webhooks, workflow_dispatch, artifacts) — domínio TS
2. Gerar templates em Python (FastMCP é o SDK mais adotado) — domínio Py
3. Ser carregável por agentes como Claude Code (que preferem Node single-binary)
4. Manter determinismo: mesma spec → mesmo output

Stacks candidatas:
- TS puro: melhor para Actions, mas gera Python ruim (sem tipagem nativa do ecossistema)
- Py puro: melhor para templates Py, mas Actions SDK é secundário
- Go: binário único, mas ecossistema MCP imaturo
- **TS+Py híbrido**: cada um no seu domínio, comunicação via subprocess/JSON

## Decisão

**Híbrido TS+Py**:
- **TS** (`builder/`): CLI, MCP server próprio, HTTP API, GitHub Action adapter, orquestração de Actions, hooks system (cross-lang), validator de schema
- **Py** (`templates/python-sdk/`): apenas o template Python gerado — não faz parte do runtime do builder

Comunicação TS↔Py: **subprocess com JSON stdin/stdout**. Sem shared memory, sem
RPC. Cada invocação Py é um processo fresh — determinismo máximo.

## Consequências

### Positivas
- TS tem melhor tooling para Actions (octokit, @actions/core)
- Py templates usam SDK nativo (FastMCP) sem transpilação
- Subprocess JSON = contratos explícitos, fácil de testar
- Agentes CLI (Claude Code) rodam só o binário TS, sem precisar de Py instalado

### Negativas
- Dois runtimes para manter
- Subprocess tem overhead (~50ms por invocação)
- Devs precisam conhecer duas stacks

### Mitigações
- Docker image oficial com ambos os runtimes pré-configurados
- Subprocess só usado em paths críticos (validator de spec, render de templates Py)
- TS é a "porta de entrada"; Py é detalhe interno

## Alternativas consideradas

1. **TS puro com templates Py como strings**: rejeitado — sem syntax highlight, sem type-check Py
2. **Py puro com Actions via PyGithub**: rejeitado — Actions SDK oficial é TS
3. **Go único**: rejeitado — mcp-go é comunidade, não oficial; rmcp é Rust

## Referências

- [GitHub Actions Toolkit](https://github.com/actions/toolkit) — TS
- [FastMCP](https://github.com/jlowin/fastmcp) — Py
- ADR-0002 (GitOps as FSM) — depende deste
