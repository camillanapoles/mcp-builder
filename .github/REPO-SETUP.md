# GitHub Repository Setup — mcp-builder

> Guia para subir o mcp-builder no GitHub e ativar os workflows FSM.

## 1. Criar repositório

```bash
cd /home/z/my-project/mcp-builder

# Já tem git init + commit inicial + tag v1.0.0 (do checkpoint)
git log --oneline
# 7b037cb feat: checkpoint v1.0.0 — MCP Builder blueprint completo

# Criar repo no GitHub (via gh CLI ou web UI)
gh repo create mcp-builder --public --source=. --remote=origin --push

# Ou manualmente via web, depois:
git remote add origin git@github.com:YOUR_USER/mcp-builder.git
git push -u origin main
git push origin v1.0.0  # push tag
```

## 2. Configurar branch protection (main)

Vá em **Settings → Branches → Add rule** para `main`:

| Setting | Value | Justificativa |
|---|---|---|
| Require pull request before merging | ✅ | Todo código passa por review |
| Require approvals | 1 | Pelo menos 1 approver |
| Require status checks to pass | ✅ | CI deve passar |
| Required status checks | `test`, `lint`, `typecheck` | Definidos em workflows |
| Require branches to be up to date | ✅ | Evita conflitos |
| Require conversation resolution | ✅ | Todos comments resolvidos |
| Require signed commits | Opcional | Recomendado para security |
| Require linear history | ✅ | Evita merge commits poluídos |
| Allow force pushes | ❌ | Nunca em main |
| Allow deletions | ❌ | Nunca em main |

## 3. Configurar secrets

Vá em **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Uso |
|---|---|
| `NPM_TOKEN` | Publicar `@mcp-builder/cli` no npm (release workflow) |
| `PYPI_TOKEN` | Publicar templates Python no PyPI (release workflow) |
| `GITHUB_TOKEN` | Automático (não precisa criar) |
| `CODECOV_TOKEN` | Opcional — cobertura em PRs |
| `MCP_BUILDER_AUDIT_SINK` | Opcional — webhook para audit log |

## 4. Ativar workflows

Os workflows em `.github/workflows/` são ativados automaticamente após push.
Para validar:

1. Vá em **Actions** tab no GitHub
2. Verifique se workflows aparecem: `Scaffold`, `Test`, `E2E`, `Release`, `Advisor Block`, `Reset`
3. Dispare um workflow manualmente via **Run workflow** button:
   - Workflow: `Scaffold`
   - Inputs: `project_name=demo-mcp`, `sdk=python`, `pattern=stateless`
4. Acompanhe o encadeamento: `scaffold.yml` → `test.yml` → `e2e.yml` → `release.yml`

## 5. Configurar issue templates (opcional, recomendado)

Crie `.github/ISSUE_TEMPLATE/`:

```bash
mkdir -p .github/ISSUE_TEMPLATE
```

Sugestões de templates:
- `bug-report.md` — para bugs
- `feature-request.md` — para novas features
- `advisor-block.md` — aberto automaticamente pelo workflow `advisor-block.yml`

## 6. Configurar Dependabot

Crie `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/builder"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
  - package-ecosystem: "pip"
    directory: "/examples/echo-stateless"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
```

## 7. Configurar CODEOWNERS

Crie `.github/CODEOWNERS`:

```
# Default owner
* @your-username

# Builder core
/builder/ @your-username

# Templates
/templates/ @your-username

# Workflows
/.github/workflows/ @your-username

# ADRs
/docs/adr/ @your-username
```

## 8. Configurar GitHub Pages (opcional)

Para servir a documentação:

1. Vá em **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, folder: `/docs`
4. Acesse em `https://YOUR_USER.github.io/mcp-builder/`

## 9. Release automation

O workflow `release.yml` cria tags + GitHub Releases automaticamente quando
o FSM atinge estado `released`. Para releases manuais:

```bash
git tag -a v1.1.0 -m "feat: blueprint methodology + 4x3 templates + hooks"
git push origin v1.1.0
```

Isto dispara o workflow `release.yml` com `workflow_dispatch`.

## 10. Métricas e insights

Habilite **Settings → Insights → Dependency graph** + **Dependabot alerts**
para monitorar vulnerabilidades em deps.

Habilite **Code security**:
- Dependency graph ✅
- Dependabot alerts ✅
- Dependabot security updates ✅
- Code scanning (CodeQL) ✅

## 11. Branches sugeridas

| Branch | Uso |
|---|---|
| `main` | Produção estável |
| `develop` | Integração de features |
| `scaffold/*` | Auto-criada pelo workflow Scaffold |
| `feature/*` | Features em desenvolvimento |
| `fix/*` | Bug fixes |
| `release/*` | Preparação de release |

## 12. Documentação pública

Após estável, publique no GitHub Pages:
- README.md como landing
- docs/ como subpáginas
- CHANGELOG.md como changelog
- ADRs como decisões arquiteturais

## Validação pós-setup

Após completar setup, valide:

```bash
# 1. Workflows rodando
gh workflow list

# 2. Última run de cada workflow
gh run list --limit 10

# 3. Secrets configurados (sem ver valor)
gh secret list

# 4. Tags
gh release list

# 5. Branch protection
gh api repos/YOUR_USER/mcp-builder/branches/main/protection
```

Tudo verde? Projeto pronto para receber contribuições.
