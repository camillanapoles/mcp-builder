# Configuração para Claude Code / Cursor / Cline

Este diretório contém configurações prontas para carregar o MCP Builder
como **MCP server** em agentes compatíveis (Claude Code, Cursor, Cline, etc.).

## Claude Code

Adicione ao `~/.config/claude-code/mcp.json` (Linux/macOS) ou
`%APPDATA%\Claude Code\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "mcp-builder": {
      "command": "node",
      "args": [
        "/path/to/mcp-builder/builder/dist/cli/index.js",
        "serve"
      ],
      "env": {
        "NODE_PATH": "/path/to/mcp-builder/builder/node_modules"
      }
    }
  }
}
```

Ou usando `npx` (sem path absoluto):
```json
{
  "mcpServers": {
    "mcp-builder": {
      "command": "npx",
      "args": ["-y", "@mcp-builder/cli", "serve"]
    }
  }
}
```

Após editar, reinicie o Claude Code. As tools disponíveis serão:

| Tool | Descrição |
|---|---|
| `create_project` | Gera novo MCP server a partir de spec |
| `add_tool` | Adiciona tool a projeto existente |
| `run_tests` | Roda testes de projeto gerado |
| `validate_spec` | Valida MCPSpec antes de scaffold |
| `transition_state` | Dispara transição FSM |
| `list_templates` | Lista templates disponíveis (4 SDKs × 3 padrões) |
| `fsm_show` | Retorna diagrama Mermaid do FSM |

## Cursor

Adicione ao `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-builder": {
      "command": "node",
      "args": ["/path/to/mcp-builder/builder/dist/cli/index.js", "serve"]
    }
  }
}
```

## Cline (VS Code extension)

Adicione via UI: **Cline** → **MCP Servers** → **Add MCP Server**:

- **Name**: mcp-builder
- **Command**: node
- **Args**: /path/to/mcp-builder/builder/dist/cli/index.js serve

## Verificação

Após carregar, peça ao agente:

```
Liste os templates disponíveis no mcp-builder.
```

Deve retornar:
```
python-sdk: stateless, event, factory
typescript-sdk: stateless, event, factory
go-sdk: stateless, event, factory
rust-sdk: stateless, event, factory
```

## Troubleshooting

### "MCP server failed to start"

Verifique:
1. Node 20+ instalado: `node --version`
2. Builder compilado: `ls /path/to/mcp-builder/builder/dist/cli/index.js`
3. Deps instaladas: `cd /path/to/mcp-builder/builder && npm install`

### "Cannot find module '@modelcontextprotocol/sdk'"

Defina `NODE_PATH` no `env` do config (ver exemplo acima).

### Tools não aparecem no agente

Reinicie o agente após editar o config. Claude Code carrega MCP servers
apenas no startup.

## Modo HTTP (alternativo)

Em vez de stdio, o builder pode rodar como HTTP API:

```bash
cd /path/to/mcp-builder/builder
node dist/cli/index.js serve:http --port 3000
```

Então qualquer agente pode chamar via HTTP:

```bash
# Listar templates
curl http://localhost:3000/templates

# Gerar projeto
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"name":"my-mcp","sdk":"python","pattern":"stateless","tools":[{"name":"hello","description":"greet","inputSchema":{"type":"object","properties":{}}}]}'
```

Útil quando o agente roda em container separado do builder.
