# MCP Builder — Operations Guide

**Version:** v1.3.0
**Last Updated:** 2026-07-09
**Status:** Production Ready (85/100)

---

## Quick Reference

| Operation | Command | Notes |
|-----------|---------|-------|
| **Bootstrap** | `mise install` | Install Node 20 + Python 3.12 |
| **Build** | `mise run build` or `cd builder && npm run build` | Compile TypeScript |
| **Test** | `mise run test` or `cd builder && npm test` | Run all tests |
| **Typecheck** | `mise run typecheck` | Verify types without emitting |
| **Watch** | `mise run watch` | Local file watcher monitoring |
| **CI Status** | `gh run list --limit 5` | Check recent CI runs |

---

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feat/your-feature

# Make changes
# ...

# Run pre-commit (automatic via hook)
git add .
git commit -m "feat: your feature"

# Run pre-push (automatic via hook)
git push origin feat/your-feature
```

### 2. CI Verification

```bash
# Wait for CI to complete
gh pr checks --watch

# All checks must pass:
# - Build (Node 20/22)
# - Test (unit/contract/property)
# - Lint
# - Security Audit
```

### 3. Merge Process

```bash
# Create PR
gh pr create --title "feat: your feature"

# Wait for CI and review
# Merge when ready
gh pr merge --squash --delete-branch
```

---

## Quality Gates

### Pre-commit (Gate Hook)

**Location:** `.githooks/pre-commit`
**Triggers:** Every `git commit`
**Checks:**
- TypeScript typecheck
- ESLint (warning only)
- Dist build verification

**Failure:** Blocks commit

### Pre-push (Advisor Hook)

**Location:** `.githooks/pre-push`
**Triggers:** Every `git push`
**Checks:**
- Mutation score (if report exists)
- All tests passing

**Failure:** Blocks push (with override option)

---

## CI/CD Pipeline

### Builder Workflow

**File:** `.github/workflows/builder.yml`
**Triggers:** Push/PR to `main`, `dev/**`

**Jobs:**
1. **Build** — Matrix (Node 20/22)
2. **Test** — Matrix (unit/contract/property)
3. **Lint** — Code quality
4. **Security** — npm audit
5. **Status** — Aggregate check

### Other Workflows

- `scaffold.yml` — Generate MCP projects
- `test.yml` — Test generated projects
- `e2e.yml` — End-to-end validation
- `release.yml` — Mutation gate + release
- `advisor-block.yml` — Failure handling
- `reset.yml` — State recovery

---

## Security

### Vulnerability Monitoring

**Dependabot:** `.github/dependabot.yml`
- **Frequency:** Weekly (Mondays)
- **Scope:** npm (builder), pip (examples)
- **Action:** Auto-creates PRs for fixes

### Local Audit

```bash
# Check dependencies
npm audit

# Fix automatically (when possible)
npm audit fix
```

---

## Monitoring

### Local Development

**File Watcher:** `scripts/watch.sh`
- **Command:** `mise run watch`
- **Behavior:** Monitors `builder/src/`, auto-runs build+test
- **Use:** Constant local feedback during development

### CI Monitoring

```bash
# Recent runs
gh run list --limit 10

# Specific run details
gh run view <run-id>

# Watch latest run
gh run watch
```

---

## Release Process

### Versioning

**Pattern:** Semantic Versioning (SemVer)
- **Major:** Breaking changes
- **Minor:** New features (backward compatible)
- **Patch:** Bug fixes

### Release Steps

```bash
# 1. Update version in package.json
cd builder
npm version <major|minor|patch>

# 2. Commit and push
git add .
git commit -m "chore: bump version to X.Y.Z"
git push

# 3. Tag (automated by release workflow or manual)
git tag vX.Y.Z
git push origin vX.Y.Z
```

---

## Rollback Procedure

### Quick Rollback

```bash
# Revert merge on main
git revert <merge-commit-hash>
git push

# Or reset to previous tag
git checkout main
git reset --hard v1.2.0
git push --force
```

### Emergency Rollback

```bash
# Identify broken commit
git log --oneline

# Create hotfix branch
git checkout -b hotfix/emergency-fix

# Apply fix, test, merge
# ...

# Tag patch release
git tag v1.3.1
git push origin v1.3.1
```

---

## Troubleshooting

### Build Failures

**Typecheck errors:**
```bash
cd builder && npm run typecheck
# Fix TypeScript errors, re-run
```

**Lint errors:**
```bash
cd builder && npm run lint
# Fix linting issues or use --fix
```

### Test Failures

```bash
# Run specific test file
npm test -- tests/failing.test.ts

# Run with debug output
npm test -- --reporter=verbose
```

### CI Failures

1. **Check logs:** `gh run view <run-id> --log`
2. **Reproduce locally:** Same commands from workflow
3. **Fix and push:** Commit fixes, new CI run triggers

---

## Git History

### Event Sourcing

The `git log` serves as the FSM event source:

```
ac75587 (v1.3.0) RFC infrastructure v1.3.0
7581a95 init
```

Each commit represents a state transition in the MCP Builder FSM.

### Tags

- `v1.0.0` — Initial blueprint (CHECKPOINT.md reference)
- `v1.2.0` — RFC infrastructure baseline
- `v1.3.0` — Production ready (current)

---

## Contact & Support

**Repository:** https://github.com/camillanapoles/mcp-builder
**Issues:** https://github.com/camillanapoles/mcp-builder/issues
**Documentation:** See `docs/` directory

---

## Maintenance Schedule

| Task | Frequency | Owner |
|------|-----------|-------|
| Dependency updates | Weekly (Dependabot) | Automated |
| Security audit | Weekly | Automated |
| Backup | Daily | GitHub |
| Release review | Per version | Maintainer |
| Documentation update | Per feature | Maintainer |

---

**Last Updated:** 2026-07-09
**Maintainer:** camillanapoles
