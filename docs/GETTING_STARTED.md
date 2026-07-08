# Getting Started

## 1. Gerar seu primeiro MCP server

### Via CLI

```bash
# Clone o monorepo
git clone <repo-url> mcp-builder
cd mcp-builder/builder

# Build
npm install
npm run build

# Gerar MCP server
node dist/cli/index.js new my-first-mcp \
  --sdk python \
  --pattern stateless \
  --tools hello,health \
  --output ../my-projects
```

### Via MCP server (Claude Code / Cursor)

Adicione ao seu `~/.config/claude-code/mcp.json`:

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

Agora o Claude Code pode chamar `create_project({name, sdk, pattern})` para
gerar MCP servers on demand.

### Via HTTP API

```bash
# Iniciar API
node dist/cli/index.js serve:http --port 3000

# Gerar projeto
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-mcp",
    "description": "My first MCP server via HTTP",
    "sdk": "python",
    "pattern": "stateless",
    "tools": [{
      "name": "hello",
      "description": "Greet the user",
      "inputSchema": {"type": "object", "properties": {"name": {"type": "string"}}}
    }]
  }'
```

## 2. Testar o MCP gerado

```bash
cd my-projects/my-first-mcp

# Instalar deps
pip install -e ".[dev]"

# Rodar testes
pytest -v --cov=my_first_mcp

# Property tests
pytest tests/test_property.py

# Iniciar server (testar manualmente)
python -m my_first_mcp.server
# Em outro terminal, mandar JSON-RPC via stdin:
# {"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

## 3. Visualizar o FSM

```bash
cd mcp-builder
node builder/dist/cli/index.js fsm show
```

Output (Mermaid):
```
stateDiagram-v2
    [*] --> draft
    draft --> scaffolded: scaffold.complete
    scaffolded --> tested: scaffold.validated
    tested --> validated: tests.passed
    validated --> released: e2e.passed
    failed --> draft: advisor.cleared
    released --> [*]
    archived --> [*]
```

## 4. Validar spec antes de gerar

```bash
echo '{
  "name": "test",
  "description": "test spec",
  "sdk": "python",
  "pattern": "stateless",
  "tools": [{"name": "x", "description": "x tool", "inputSchema": {"type": "object", "properties": {}}}]
}' > spec.json

node builder/dist/cli/index.js validate spec.json
```

## 5. Disparar workflow no GitHub

Após push para GitHub, você pode disparar o FSM via UI:

1. Vá em **Actions** → **Scaffold** → **Run workflow**
2. Inputs: `project_name=my-mcp`, `sdk=python`, `pattern=stateless`
3. O fluxo encadeado será:
   - `scaffold.yml` → gera projeto + artifact
   - `test.yml` → baixa artifact, roda testes (matrix)
   - `e2e.yml` → valida server end-to-end
   - `release.yml` → mutation gate + tag + release

Em caso de falha em qualquer etapa, `advisor-block.yml` abre uma issue
com o motivo e sugestões.

Para recuperar:
```bash
# Comente na issue aberta:
/advisor-clear
```

Isso dispara `reset.yml` que volta o FSM para `draft`.

## 6. Exemplo pronto

Veja `examples/echo-stateless/` — um MCP server completo gerado pelo builder,
com testes unit + property + contract, FSM, workflow CI. Use como referência.

```bash
cd examples/echo-stateless
pip install -e ".[dev]"
pytest -v
```

## Próximos passos

- Leia `docs/BLUEPRINT.md` para a arquitetura completa
- Leia `docs/adr/` para decisões técnicas
- Veja `hooks/README.md` para criar hooks customizados
- Veja `templates/` para criar novos templates
