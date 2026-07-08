# Blueprint Methodology — Adoção das Práticas Declarativas

> **Status**: Aprovado • **Versão**: 1.1.0 • **Base**: metodologia Devin, aplicada sem usar Devin

Este documento descreve como o mcp-builder adota a **metodologia de configuração
declarativa de ambiente** popularizada pelo Devin, mas **desvinculada da
plataforma Devin** — rodando localmente e em GitHub Actions.

---

## 1. Por que adotar esta metodologia

### Problema que resolve

MCP servers gerados pelo builder precisam de **ambiente reproduzível**:
- Mesmas versões de runtime (Python/Node/Go/Rust)
- Mesmas deps instaladas
- Mesmos comandos de lint/test/build
- Mesmas variáveis de ambiente
- Mesmas secrets acessíveis

Sem uma metodologia declarativa, isso vira:
- READMEs desatualizados
- Scripts shell ad-hoc espalhados
- CI diferente de dev local
- Onboarding lento (cada dev descobre como rodar)

### Solução

Um **Blueprint** é um arquivo YAML declarativo que descreve exatamente
**o que** o ambiente precisa ter — não **como** chegar lá (que fica a cargo
do `BlueprintExecutor`).

---

## 2. Estrutura do Blueprint

Um blueprint tem 5 seções, todas opcionais:

```yaml
name: my-mcp-blueprint
scope: repository   # repository | organization | enterprise

initialize:         # roda uma vez por build
  - name: Install Python
    uses: github.com/actions/setup-python@v5
    with:
      python-version: "3.12"

maintenance:        # roda a cada build (e surfaced ao agente)
  - run: pip install -e ".[dev]"

knowledge:          # NÃO executado — referência para o agente
  - name: test
    contents: pytest -v --cov=my_mcp

post-build:         # org/enterprise only — após todos repos clone
  - run: node --version

clone:              # repo only — override git clone defaults
  path: my-mcp
  ref: main
  depth: 1

env:                # variáveis globais
  MCP_PATTERN: stateless

secrets:            # nomes de secrets esperados
  - PYPI_TOKEN
```

### 2.1 `initialize`

**Quando roda**: Apenas durante builds, uma vez. Resultados salvos no snapshot.

**O que colocar**:
- Linguagens e runtimes (Python, Node, Go, Rust)
- Ferramentas globais (pnpm, uv, ripgrep)
- Pacotes de sistema (apt-get)
- GitHub Actions (`uses: github.com/actions/setup-*`)

**Não colocar**:
- Deps do projeto (isso vai em `maintenance`)
- Comandos que dependem do código (que ainda não foi clonado)

### 2.2 `maintenance`

**Quando roda**: A cada build + surfaced ao agente em cada sessão.

**O que colocar**:
- `npm install`, `pip install -e .`, `cargo build`
- Migrations de banco
- Configuração que precisa do código presente

**Semântica especial**: Em sessões (não builds), `maintenance` NÃO é
auto-executado. O agente recebe os comandos como contexto e decide se
re-roda (ex: após `git pull` que mudou `package.json`).

### 2.3 `knowledge`

**Quando roda**: NUNCA executado. Apenas surfaced ao agente como referência.

**O que colocar**:
- Comandos de lint, test, build, deploy
- Comandos para iniciar dev server
- Instruções de debug

Por convenção, nomes padrão: `lint`, `test`, `build`, `run-server`.
Outros nomes customizados são permitidos (`deploy`, `database`, `migration`).

### 2.4 `post-build`

**Quando roda**: Após todos os repositórios serem clonados e `initialize`/`maintenance`
de cada um rodarem. **Apenas em blueprints de organization/enterprise.**

**O que colocar**:
- Health checks cross-repo (ex: `test -d ~/repos/my-service`)
- Verificação de toolchain (`node --version`)
- Smoke tests que precisam do ambiente completo

**Comportamento**: Se um step `post-build` falha (exit ≠ 0), o build inteiro
falha e nenhum snapshot é produzido.

### 2.5 `clone`

**Quando roda**: Durante o clone do repositório (repo-level only).

**O que colocar**:
- `path`: destino sob `~/repos/` (default: nome curto do repo)
- `ref`: branch ou tag (default: branch default)
- `depth`: 0 = full, N = shallow
- `tags`: false = `--no-tags`
- `submodules`: true | false | `"recursive"`
- `lfs`: false = `GIT_LFS_SKIP_SMUDGE=1`

---

## 3. Composição de blueprints

Blueprints são **aditivos** em 3 níveis (igual ao Devin):

| Nível | Onde | O que colocar |
|---|---|---|
| Enterprise | Settings globais | Ferramentas cross-org |
| Organization | Settings da org | Ferramentas compartilhadas (Python, Node, etc.) |
| Repository | Settings do repo | Setup específico do projeto (npm install, etc.) |

Ordem de execução durante um build:
```
1. Enterprise: initialize + maintenance
2. Organization: initialize + maintenance
3. Clone todos os repos
4. Para cada repo: initialize + maintenance
5. Post-build (org/enterprise)
6. Health check → snapshot salvo
```

---

## 4. Variáveis de ambiente e secrets

### 4.1 Step-level env

```yaml
- name: Install with custom registry
  run: pip install -r requirements.txt
  env:
    PIP_INDEX_URL: https://pypi.example.com/simple/
    PIP_BREAK_SYSTEM_PACKAGES: "1"
```

Escopo: apenas aquele step.

### 4.2 Cross-step env via `$MCP_ENVRC`

Para propagar env entre steps, escreva no arquivo especial `$MCP_ENVRC`:

```yaml
- name: Set shared variables
  run: |
    echo 'export DATABASE_URL=postgresql://localhost:5432/myapp' >> $MCP_ENVRC
    echo 'export APP_ENV=development' >> $MCP_ENVRC

- name: Use shared variable
  run: |
    source $MCP_ENVRC
    echo "DB: $DATABASE_URL"
```

`$MCP_ENVRC` é resetado a cada build. Equivalente ao `$GITHUB_ENV` do GitHub
Actions e ao `$ENVRC` do Devin.

### 4.3 Secrets

Liste os nomes em `secrets: []`. Eles serão injetados como env vars antes
de cada step. Origem:

- **Local**: `.env` file (não commitado)
- **CI**: GitHub Actions secrets
- **Plataformas**: Vaults (Vault, AWS Secrets Manager, etc.)

```yaml
secrets:
  - PYPI_TOKEN
  - NPM_TOKEN

maintenance:
  - name: Configure npm registry
    run: |
      echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" >> ~/.npmrc
```

**Importante**: Secrets são scrubbed do snapshot. Se um `maintenance` step
escreve uma secret em arquivo de config (ex: `~/.npmrc`), esse arquivo
persiste no snapshot. Para máxima segurança, use env vars ou `$MCP_ENVRC`.

---

## 5. Step types: `run` vs `uses`

### `run` — shell command

```yaml
- name: Build
  run: |
    npm run build
    npm run test
```

Use para:
- Comandos shell arbitrários
- Instalar pacotes de sistema (`apt-get`)
- Scripts do projeto (`npm install`, `pip install`)
- Configurar arquivos/env

### `uses` — GitHub Action

```yaml
- name: Install Python
  uses: github.com/actions/setup-python@v5
  with:
    python-version: "3.12"
```

Use para:
- Setup de linguagens (setup-python, setup-node, setup-go, etc.)
- Actions oficiais quando existem
- Casos onde você quer version management automático

**Formato obrigatório**: `github.com/<owner>/<repo>[@<ref>]`

**Limitação**: Apenas Actions baseadas em Node.js são suportadas (sem Docker,
sem composite).

---

## 6. Multi-document YAML

Blueprints suportam multi-document via separador `---`:

```yaml
name: workspace-1
initialize: echo "setup 1"
---
name: workspace-2
initialize: echo "setup 2"
```

Útil para monorepos com múltiplos workspaces que precisam de setup próprio.

---

## 7. Diferenças vs Devin original

| Aspecto | Devin | mcp-builder |
|---|---|---|
| Plataforma | Cloud Devin | Local + GitHub Actions |
| Snapshot | VM image | GitHub Actions cache + artifact |
| Env propagation | `$ENVRC` | `$MCP_ENVRC` (mesma semântica) |
| Secrets | Devin UI | `.env` local / Actions secrets |
| Knowledge | Injetado no agente Devin | Surfaced via MCP resource |
| Builds | A cada ~24h + on-change | On git push + on-demand |
| Scope | Enterprise > Org > Repo | Org > Repo (sem enterprise) |
| Actions suportadas | Node.js-based | Node.js-based (igual) |

**Tudo que funciona no Devin funciona aqui**, com a diferença de que
rodamos localmente ou em CI próprio, sem dependência de plataforma externa.

---

## 8. Como o builder usa blueprints

### 8.1 Cada MCP gerado vem com `blueprint.yaml`

Os templates incluem `blueprint.yaml.hbs` (renderizado pelo scaffolder).
Exemplo do template Python stateless:

```yaml
# gerado pelo scaffold
name: my-mcp-blueprint
initialize:
  - uses: github.com/actions/setup-python@v5
    with: { python-version: "3.12" }
maintenance:
  - run: pip install -e ".[dev]"
knowledge:
  - name: test
    contents: pytest -v --cov=my_mcp
```

### 8.2 Builder pode executar blueprint via CLI

```bash
# Validar blueprint
mcp-builder blueprint validate path/to/blueprint.yaml

# Executar localmente (dev)
mcp-builder blueprint run path/to/blueprint.yaml

# Mostrar knowledge entries
mcp-builder blueprint knowledge path/to/blueprint.yaml
```

### 8.3 GitHub Actions workflow usa blueprint

O workflow `scaffold.yml` poderia ser estendido para:

```yaml
- name: Run project blueprint
  run: |
    cd builder
    node dist/cli/index.js blueprint run ../examples/echo-stateless/blueprint.yaml
```

Isto executa `initialize` + `maintenance` do blueprint, garantindo que
o ambiente de CI bate com o ambiente de dev.

### 8.4 Knowledge surfaced como MCP resource

Quando o builder roda como MCP server, ele expõe o `knowledge` do blueprint
atual como resource `knowledge://blueprint` — o agente (Claude Code, Cursor)
pode consultar os comandos corretos de lint/test/build sem precisar de README.

---

## 9. Blueprints no nosso projeto

### 9.1 Blueprint da organização (mcp-builder)

`.mcp/blueprint.yaml` — descreve o ambiente do PRÓPRIO monorepo builder.

Inclui:
- `initialize`: Node 20, Python 3.12, Go 1.22, Rust stable
- `maintenance`: `npm install` no builder, `pip install` no exemplo
- `knowledge`: comandos lint/test/build/generate/serve/mutation
- `post-build`: valida toolchain + builder builds + example tests
- `secrets`: NPM_TOKEN, PYPI_TOKEN, GITHUB_TOKEN

### 9.2 Blueprint de cada template

Cada um dos 6 templates (4 SDKs × 3 padrões, com 2 padrões faltantes em TS/Go/Rust)
tem seu próprio `blueprint.yaml.hbs`:

- `templates/python-sdk/stateless/blueprint.yaml.hbs`
- `templates/python-sdk/event/blueprint.yaml.hbs`
- `templates/python-sdk/factory/blueprint.yaml.hbs`
- `templates/typescript-sdk/stateless/blueprint.yaml.hbs`
- `templates/go-sdk/stateless/blueprint.yaml.hbs`
- `templates/rust-sdk/stateless/blueprint.yaml.hbs`

### 9.3 Blueprint do exemplo

`examples/echo-stateless/blueprint.yaml` — demostra o blueprint em ação
para um MCP server real e testável.

---

## 10. Boas práticas

### 10.1 Mantenha `initialize` enxuto

Coloque APENAS runtimes e ferramentas globais. Tudo que depende do código
vai em `maintenance`.

### 10.2 `maintenance` deve ser idempotente

`npm install` é idempotente. `npm ci` também. Mas `npm run migrate` pode
não ser — prefira `migrate:up` (sempre safe) em vez de `migrate` (que pode
reverter).

### 10.3 Knowledge deve ser curto e direto

Não escreva ensaios. Apenas comandos. Se precisar de contexto, use
o standalone Knowledge feature (`.mcp/knowledge/*.md`).

### 10.4 Secrets: scoped e mínimo

Liste apenas o que cada blueprint realmente precisa. Não adicione "por via
das dúvidas" — secrets são surface area de ataque.

### 10.5 Versione blueprints com o código

`blueprint.yaml` vive no repo. Mudanças no ambiente acompanham mudanças
no código (via PR review). Isto é **Git-backed blueprints** (igual ao
Devin, mas sem a API de sync — usamos git direto).

---

## 11. Roadmap

### v1.1.0 (atual)
- Blueprint engine (parser + executor) ✅
- 6 blueprints de template ✅
- Blueprint do projeto raiz ✅
- Esta documentação ✅

### v1.2.0 (próximo)
- Comando `mcp-builder blueprint validate|run|knowledge` na CLI
- GitHub Action que valida blueprint em PR
- Cache de snapshots baseado em `hashBlueprint()`

### v1.3.0
- Differential builds (estilo Devin) — só re-executa workspaces que mudaram
- Workspaces para monorepos (blueprint por subdiretório)
- Integração com act (rodar workflows localmente)

### v2.0.0
- Blueprints como MCP resources (surfaced ao agente em runtime)
- UI web para visualizar blueprints e builds
- Sync via API REST (estilo Devin) — opcional

---

## 12. Referências

- `builder/src/blueprint/` — implementação TS
- `builder/tests/blueprint/` — testes (31 testes passing)
- `.mcp/blueprint.yaml` — blueprint do projeto raiz
- `templates/*/blueprint.yaml.hbs` — blueprints de cada template
- `examples/echo-stateless/blueprint.yaml` — exemplo funcional
- [Blueprints.md (Devin, fonte de inspiração)](https://docs.devin.ai/onboard-devin/environment/blueprints)
- [Blueprint Reference (Devin)](https://docs.devin.ai/onboard-devin/environment/blueprint-reference)
