# Templates — Como Criar e Estender

Templates são a base da geração de MCP servers. Cada template é uma combinação
de **SDK** (Python/TypeScript/Go/Rust) × **padrão** (event/factory/stateless).

## Estrutura de um template

```
templates/<sdk>-sdk/<pattern>/
├── README.md.hbs              # documentação do MCP gerado
├── <package-config>.hbs       # pyproject.toml.hbs / package.json.hbs / etc
├── mcp.json.hbs               # config para Claude Desktop / Cursor
├── src/                       # código-fonte do MCP gerado
│   └── {{name}}/              # {{name}} é substituído pelo nome do projeto
│       ├── server.py.hbs      # entry point
│       ├── tools.py.hbs       # tools (uma por @mcp.tool())
│       └── ...
├── tests/                     # testes (unit + property + contract)
├── .mcp/state/                # FSM específico do MCP gerado
│   ├── states.yaml
│   └── transitions.yaml
├── .github/workflows/         # CI do MCP gerado
└── docs/adr/                  # ADRs do MCP gerado
```

## Convenções de Handlebars

### Variáveis disponíveis

| Variável | Conteúdo |
|---|---|
| `{{name}}` | Nome do projeto (kebab-case) |
| `{{description}}` | Descrição da spec |
| `{{spec.name}}` | Igual a `{{name}}` |
| `{{spec.sdk}}` | `python` / `typescript` / `go` / `rust` |
| `{{spec.pattern}}` | `event` / `factory` / `stateless` |
| `{{#each tools}}` | Itera sobre tools da spec |
| `{{this.name}}` (dentro do each) | Nome da tool |
| `{{this.description}}` | Descrição da tool |
| `{{this.inputSchema}}` | JSON Schema da tool |
| `{{metadata.author}}` | Autor da spec |
| `{{metadata.license}}` | Licença |

### Helpers customizados registrados

| Helper | O que faz | Exemplo |
|---|---|---|
| `pascalCase` | Converte para PascalCase | `{{pascalCase name}}` → `MyServer` |
| `camelCase` | Converte para camelCase | `{{camelCase name}}` → `myServer` |
| `snakeCase` | Converte para snake_case | `{{snakeCase name}}` → `my_server` |
| `kebabCase` | Converte para kebab-case | `{{kebabCase name}}` → `my-server` |
| `eq` | Igualdade | `{{#if (eq sdk "python")}}...{{/if}}` |
| `includes` | Array.includes | `{{#if (includes hooks.gate "validate_spec")}}...{{/if}}` |
| `join` | Array.join | `{{join tools ", "}}` |
| `json` | JSON.stringify (sem escape) | `{{{json inputSchema}}}` |

### Renderização de nomes de arquivo

Nomes de arquivo e diretórios também são renderizados:

- `{{name}}.py.hbs` → `myserver.py`
- `src/{{name}}/` → `src/myserver/`
- `.github/workflows/ci.yml.hbs` → `.github/workflows/ci.yml`

Arquivos `.hbs` têm a extensão removida no destino. Outros arquivos são
copiados literalmente.

## Como criar um novo template

### 1. Escolher SDK + padrão

| SDK | Variável | Package config |
|---|---|---|
| Python | `python-sdk` | `pyproject.toml.hbs` |
| TypeScript | `typescript-sdk` | `package.json.hbs` |
| Go | `go-sdk` | `go.mod.hbs` |
| Rust | `rust-sdk` | `Cargo.toml.hbs` |

### 2. Criar estrutura base

```bash
mkdir -p templates/python-sdk/my-pattern/{src/{{name}},tests,.mcp/state,docs/adr}
```

### 3. Escrever arquivos

Mínimo necessário:
- `README.md.hbs` — explica o padrão
- `pyproject.toml.hbs` (ou equivalente)
- `src/{{name}}/server.py.hbs` — entry point
- `.mcp/state/states.yaml` — FSM
- `.mcp/state/transitions.yaml`
- `tests/test_basic.py.hbs` — pelo menos 1 teste

### 4. Validar template

```bash
cd builder
node dist/cli/index.js new test-proj --sdk python --pattern my-pattern --output /tmp/test
```

### 5. Adicionar testes contract

Em `builder/tests/contract.test.ts`, adicione `my-pattern` ao array
`EXPECTED_PATTERNS`. Isso garante que o template tem os arquivos esperados.

## Padrões disponíveis

### stateless

**Quando usar**: Tools são funções puras, sem estado entre chamadas.

**Estrutura**:
```
src/{{name}}/
  server.py       # entry point
  app.py          # FastMCP instance
  tools.py        # @mcp.tool() functions
  resources.py    # @mcp.resource() read-only context
```

**FSM states**: `idle → running → completed | failed`

### event

**Quando usar**: MCP reage a eventos externos (webhooks, schedules).

**Estrutura**:
```
src/{{name}}/
  server.py       # entry point
  events/bus.py   # pub/sub
  handlers/       # business logic per event
  state/projections.py  # read models
```

**FSM states**: `idle → event_received → projected | failed`

### factory

**Quando usar**: MCP cria objetos tipados a partir de input do LLM.

**Estrutura**:
```
src/{{name}}/
  server.py       # entry point
  factories/      # uma factory por tipo de objeto
  validators/     # JSON Schema validators
  registry/       # registro de objetos criados
```

**FSM states**: `idle → creating → registered | failed`

## Boas práticas

1. **Sempre incluir `.mcp/state/`** — todo MCP gerado tem FSM próprio
2. **Sempre incluir `mcp.json.hbs`** — integração com Claude Desktop / Cursor
3. **Sempre incluir 3 tipos de teste** (unit, property, contract)
4. **ADR documentando o padrão** — `docs/adr/0001-<pattern>.md.hbs`
5. **CI workflow** — pelo menos `ci.yml.hbs` com lint + test
6. **Sempre usar helpers de case** — nunca hardcode PascalCase/snake_case
7. **Variáveis no nome de arquivo** — `{{name}}.py.hbs` é melhor que `server.py.hbs` se o nome do módulo importa

## Exemplos

Veja `templates/python-sdk/stateless/` como referência completa.
Veja `examples/echo-stateless/` como exemplo renderizado (resultado final).
