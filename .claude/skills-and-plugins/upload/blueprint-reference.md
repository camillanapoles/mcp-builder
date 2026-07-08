> ## Documentation Index
> Fetch the complete documentation index at: https://docs.devin.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Blueprint reference

> Complete field reference for blueprints: sections, step types, GitHub Actions, environment variables, secrets, and file attachments.

<Info>
  This is the full field reference for blueprints. For an introduction to blueprints and how they fit into Devin's environment, see [Declarative environment configuration](/onboard-devin/environment/blueprints).
</Info>

A blueprint defines how Devin's environment is configured: what tools to install, how to keep dependencies up to date, and what commands Devin should know about.

## Overview

A blueprint has three core top-level sections, plus a `post-build` section for org- and enterprise-level blueprints and an optional `clone` section for repo-level blueprints:

```yaml theme={null}
initialize: ...   # Install tools and runtimes
maintenance: ...  # Install project dependencies
knowledge: ...    # Reference info for Devin (never executed)
post-build: ...   # (Org/enterprise only) Commands that run after all setup
clone: ...        # (Repo-level only) Override git-clone defaults
```

| Section       | Purpose                                                                       | Executed?                                                                       |
| ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `initialize`  | Install system tools, language runtimes, global CLIs                          | During full builds and for rebuilt workspaces                                   |
| `maintenance` | Install and update project dependencies                                       | Yes, during builds. Surfaced to the agent at session start (not auto-executed). |
| `knowledge`   | Tell Devin how to lint, test, build, and other project-specific info          | No, provided as reference                                                       |
| `post-build`  | Commands that run after all repos are cloned and set up (org/enterprise only) | Yes, during builds — a non-zero exit code fails the build                       |
| `clone`       | Override how the repository is cloned into the snapshot (repo-level only)     | Applied during the build's clone step                                           |

All sections are optional. You can include any combination.

`initialize` runs during full builds and for workspaces rebuilt from scratch. Results are saved in the snapshot. In a [differential build](/onboard-devin/environment/differential-builds), inherited workspaces skip `initialize`, pull the latest code, and run only `maintenance`. Write `maintenance` so it is self-contained and can run independently on top of the existing snapshot without requiring `initialize` to run immediately beforehand or relying on environment variables that `initialize` previously wrote to `$ENVRC`. At the start of every session, `maintenance` commands are **not auto-executed** — instead, they are surfaced to the agent as context so it knows which dependency commands to run if needed (e.g. after pulling latest code). Commands should still be fast and incremental. Builds run automatically when your blueprint changes and periodically (every \~24 hours).

## initialize

Use `initialize` for installing tools and runtimes that don't depend on the specific state of your code: language runtimes, system packages, global CLIs.

### Simple form

For straightforward shell commands, use a block scalar:

```yaml theme={null}
initialize: |
  curl -LsSf https://astral.sh/uv/install.sh | sh
  apt-get update && apt-get install -y build-essential
  npm install -g pnpm
```

### Structured form

For named steps, environment variables, or GitHub Actions, use a list:

```yaml theme={null}
initialize:
  - name: "Install Python 3.12"
    uses: github.com/actions/setup-python@v5
    with:
      python-version: "3.12"

  - name: "Install system packages"
    run: |
      apt-get update
      apt-get install -y libpq-dev

  - name: "Install global tools"
    run: pip install uv
    env:
      PIP_BREAK_SYSTEM_PACKAGES: "1"
```

Both forms can be mixed. The simple form is equivalent to a single step with `run`.

### When to use initialize vs maintenance

| Put in `initialize`                   | Put in `maintenance`          |
| ------------------------------------- | ----------------------------- |
| Language runtime installation         | `npm install` / `pip install` |
| System packages (`apt-get`)           | `bundle install`              |
| Global CLI tools                      | `go mod download`             |
| One-time configuration                | Dependency cache updates      |
| GitHub Actions (`setup-python`, etc.) | Repo-specific setup scripts   |

Both sections run during full builds. In differential builds, inherited workspaces skip `initialize` and run only `maintenance` after pulling the latest code. Tools and runtimes go in `initialize`; dependency commands that track your code's lock files go in `maintenance`.

## maintenance

Use `maintenance` for dependency installation and other commands that should run after your code is cloned. These commands run during builds and are surfaced to the agent at session start so it can re-run them if dependencies have changed. This is where `npm install`, `pip install`, `uv sync`, and similar commands belong.

```yaml theme={null}
maintenance: |
  npm install
  pip install -r requirements.txt
```

Or in structured form:

```yaml theme={null}
maintenance:
  - name: "Install npm dependencies"
    run: npm install

  - name: "Install Python dependencies"
    run: uv sync
    env:
      UV_CACHE_DIR: /tmp/uv-cache
```

<Info>
  For repo-level blueprints, `maintenance` commands run from the repository root directory. For org-level blueprints, they run from the home directory (`~`).
</Info>

## knowledge

The `knowledge` section is **not executed**. It provides reference information that Devin uses when working in your project. This is how you tell Devin the correct commands for linting, testing, building, and any other project-specific workflows.

```yaml theme={null}
knowledge:
  - name: lint
    contents: |
      Run linting with:
      npm run lint

      For auto-fix:
      npm run lint -- --fix

  - name: test
    contents: |
      Run the full test suite:
      npm test

      Run a single test file:
      npm test -- path/to/test.ts

  - name: build
    contents: |
      npm run build

      Build output goes to dist/
```

Each knowledge item has:

| Field      | Type   | Description                                                        |
| ---------- | ------ | ------------------------------------------------------------------ |
| `name`     | string | Identifier for this knowledge item (e.g., `lint`, `test`, `build`) |
| `contents` | string | Free-form text with commands, instructions, or notes               |

The `name` field is a label. By convention, `lint`, `test`, and `build` are the standard names. Devin references these when verifying its work. You can add any additional knowledge items with custom names:

```yaml theme={null}
knowledge:
  - name: lint
    contents: ...
  - name: test
    contents: ...
  - name: build
    contents: ...
  - name: deploy
    contents: |
      Deploy to staging:
      npm run deploy:staging
  - name: database
    contents: |
      Run migrations:
      npm run db:migrate

      Seed test data:
      npm run db:seed
```

## post-build

The `post-build` section is available on **organization-level and enterprise-level blueprints only** (it is not supported in repo-level blueprints). Its steps run during the build **after all repositories have been cloned and their `initialize` and `maintenance` steps have completed**, but before the health check and the snapshot image is created. This makes it the right place for cross-repo validation and health checks that need the fully assembled environment.

Because it runs late in the build with the whole environment in place, a `post-build` step can see every cloned repo and every tool installed by the enterprise, org, and repo blueprints.

```yaml theme={null}
post-build: |
  # Verify the assembled environment is healthy
  node --version
  python --version
  test -d ~/repos/my-service
```

Or in structured form:

```yaml theme={null}
post-build:
  - name: "Verify toolchain"
    run: |
      node --version
      uv --version

  - name: "Smoke-test the workspace"
    run: ~/repos/my-service/scripts/healthcheck.sh
```

<Warning>
  `post-build` steps **fail the build on a non-zero exit code**. If a `post-build` step exits non-zero, the build is marked failed and no snapshot image is produced. Use this to gate snapshots on health checks — but make sure the commands are reliable so a flaky check doesn't block your builds.
</Warning>

<Info>
  `post-build` steps use the same [step types](#step-types) as `initialize` and `maintenance` (shell `run` commands and GitHub Actions `uses`), and run from the home directory (`~`).
</Info>

## clone

For **repo-level blueprints**, the optional `clone` section overrides defaults used when Devin clones the repository into the snapshot. Every field is optional and falls back to a sensible default that preserves current behavior.

```yaml theme={null}
clone:
  path: my-project        # clone destination under ~/repos/ (default: repo short name)
  ref: develop            # branch or tag to check out (default: repo's default branch)
  depth: 1                # 0 = full history, N = --depth N (default: 0)
  tags: false             # false passes --no-tags (default: true)
  submodules: recursive   # true / false / "recursive" (default: true)
  lfs: false              # false sets GIT_LFS_SKIP_SMUDGE=1 during clone (default: true)
```

| Field        | Type                  | Default               | Description                                                                                                  |
| ------------ | --------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ |
| `path`       | string                | repo short name       | Override the clone destination directory under `~/repos/`. Must be unique across repos in the same snapshot. |
| `ref`        | string                | repo's default branch | Branch or tag to check out after cloning. Commit SHAs are not supported here.                                |
| `depth`      | int                   | `0`                   | Clone depth. `0` clones the full history; any positive value passes `--depth N` for a shallow clone.         |
| `tags`       | bool                  | `true`                | When `false`, passes `--no-tags` to skip fetching git tags.                                                  |
| `submodules` | bool or `"recursive"` | `true`                | `true` or `"recursive"` passes `--recurse-submodules`. `false` skips submodules entirely.                    |
| `lfs`        | bool                  | `true`                | When `false`, sets `GIT_LFS_SKIP_SMUDGE=1` to skip Git LFS object downloads during clone.                    |

<Info>
  `clone` only applies to **repo-level** blueprints — it controls how that specific repo is cloned into the snapshot. It has no effect in org-level or enterprise-level blueprints.
</Info>

## Step types

Each step in `initialize`, `maintenance`, or `post-build` uses one of two types: shell commands (`run`) or GitHub Actions (`uses`).

### Shell commands (`run`)

Execute arbitrary shell commands in bash:

```yaml theme={null}
- name: "Install dependencies"
  run: |
    npm install
    pip install -r requirements.txt
```

| Field  | Type              | Description                               |
| ------ | ----------------- | ----------------------------------------- |
| `name` | string (optional) | Human-readable label for the step         |
| `run`  | string            | Shell command(s) to execute               |
| `env`  | map (optional)    | Extra environment variables for this step |

**Execution details:**

* Commands run in bash. If any command in a multi-line script fails, the entire step stops immediately.
* Org-level blueprints execute in the home directory (`~`).
* Repo-level blueprints execute in the cloned repository root.
* Each step has a timeout of 1 hour.
* Secrets are automatically available as environment variables.

### GitHub Actions (`uses`)

Run Node.js-based GitHub Actions directly in your blueprint:

```yaml theme={null}
- name: "Install Python"
  uses: github.com/actions/setup-python@v5
  with:
    python-version: "3.12"
```

| Field  | Type              | Description                               |
| ------ | ----------------- | ----------------------------------------- |
| `name` | string (optional) | Human-readable label for the step         |
| `uses` | string            | GitHub Action reference                   |
| `with` | map (optional)    | Input parameters for the action           |
| `env`  | map (optional)    | Extra environment variables for this step |

**Action reference format:**

```
github.com/<owner>/<repo>@<ref>
github.com/<owner>/<repo>/<subpath>@<ref>
```

The `github.com/` prefix and `@<ref>` suffix are both required. The ref is typically a version tag like `v5`.

**Commonly used actions:**

| Action                                      | Purpose          | Example `with`                                  |
| ------------------------------------------- | ---------------- | ----------------------------------------------- |
| `github.com/actions/setup-python@v5`        | Install Python   | `python-version: "3.12"`                        |
| `github.com/actions/setup-node@v4`          | Install Node.js  | `node-version: "20"`                            |
| `github.com/actions/setup-go@v5`            | Install Go       | `go-version: "1.22"`                            |
| `github.com/actions/setup-java@v4`          | Install Java/JDK | `java-version: "21"`, `distribution: "temurin"` |
| `github.com/gradle/actions/setup-gradle@v4` | Install Gradle   | (none)                                          |
| `github.com/ruby/setup-ruby@v1`             | Install Ruby     | `ruby-version: "3.3"`                           |

<Warning>
  Only **Node.js-based** GitHub Actions are supported. Composite actions and Docker-based actions are not supported.
</Warning>

**How `with` values work:**

Values passed via `with` are provided to the action as inputs, following the same conventions as GitHub Actions workflows. All values are converted to strings.

```yaml theme={null}
with:
  python-version: "3.12"
  check-latest: true
  cache: "pip"
```

**How actions propagate changes:**

Actions can modify the environment for subsequent steps. For example, `setup-python` adds the Python binary to `PATH`, which remains available for all later steps and in `maintenance`.

### run vs uses: which to use

| Use `run` when...                        | Use `uses` when...                                          |
| ---------------------------------------- | ----------------------------------------------------------- |
| Installing system packages (`apt-get`)   | Setting up language runtimes (Python, Node, Go, Java, Ruby) |
| Running project-specific scripts         | An official GitHub Action exists for what you need          |
| Configuring files or environment         | You want automatic version management and caching           |
| The command is simple and self-contained | You'd use the same Action in a GitHub Actions workflow      |

In practice, most configurations use `uses` for language runtimes and `run` for everything else.

## Environment variables and secrets

### Step-level environment variables

Any step can define extra environment variables with the `env` field:

```yaml theme={null}
- run: pip install -r requirements.txt
  env:
    PIP_INDEX_URL: "https://pypi.example.com/simple/"
    PIP_BREAK_SYSTEM_PACKAGES: "1"
```

These are scoped to the step and don't persist to subsequent steps.

### Cross-step environment variables (`$ENVRC`)

To propagate environment variables across steps, write them to the `$ENVRC` file:

```yaml theme={null}
- name: "Set shared variables"
  run: |
    echo "DATABASE_URL=postgresql://localhost:5432/myapp" >> $ENVRC
    echo "APP_ENV=development" >> $ENVRC
```

Variables written to `$ENVRC` are automatically exported and available to all
subsequent steps and the Devin session produced by the current build. This works
similarly to `$GITHUB_ENV` in GitHub Actions.

This also applies to `PATH`. If you install a tool to a non-standard directory
(anything outside `/usr/bin` or `/usr/local/bin`), append it to `$ENVRC` so
subsequent steps and repo-level blueprints can find the binary:

```yaml theme={null}
- name: "Install latest direnv"
  run: |
    curl -sfL https://direnv.net/install.sh | bash
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> $ENVRC
```

A plain `export PATH=...` inside a `run:` block only affects that step's shell.
Each step starts a new shell process, so `PATH` changes that are not written to
`$ENVRC` are lost.

<Info>
  `uses:` actions (e.g. `actions/setup-node`) automatically propagate their `PATH`
  additions to `$ENVRC` — you only need to do this manually for `run:` steps.
</Info>

`$ENVRC` is reset at the start of every build, including differential builds.
Values written during one build are not available to the next build. In
particular, an inherited workspace runs only `maintenance`, so it cannot rely on
`PATH` or other variables that `initialize` wrote to `$ENVRC` in the parent
build. Configure any environment required by `maintenance` within
`maintenance` itself.

<script src="/anchor-scroll-fix.js" />

### Secrets

Secrets configured in the Devin UI (via the **Secrets** tab in each blueprint editor) are automatically injected as environment variables. You don't declare them in your blueprint. Just reference them by name (e.g., `$MY_SECRET`).

Secrets are injected before every step runs during builds **and** re-injected at the start of every session. They are scrubbed from the snapshot image itself, so credentials are never baked into saved machine images.

* **Organization secrets**: Available as environment variables in every step across all blueprints in the org. Set these in the **Secrets** tab of the org-wide blueprint editor.
* **Enterprise secrets**: Merged with org secrets (org secrets take precedence on name collisions). Available across all orgs in the enterprise.
* **Repository secrets**: Written to a per-repo file at `/run/repo_secrets/{owner/repo}/.env.secrets`. During builds, repo secrets are automatically sourced before that repo's blueprint steps run. At session time, Devin sources them when working in the repo. Configure these in the **Secrets** tab of the repository's blueprint editor.

<Info>
  **Build-only secrets**: Secrets marked as "build only" are available during snapshot builds but removed before the snapshot is saved. Use these for credentials needed only at build time (e.g., downloading private artifacts during `initialize`).
</Info>

<Warning>
  `maintenance` runs during builds. At session start, `maintenance` commands are surfaced to the agent (not auto-executed), so the agent may re-run them if needed. If a `maintenance` step writes secrets into config files (e.g., `~/.m2/settings.xml`, `~/.npmrc`), those files will be baked into the snapshot. Place credential-writing steps in `maintenance` (not `initialize`) so they are refreshed during periodic builds, but be aware the written files persist in the image. For maximum security, use environment variables or `$ENVRC` instead of writing credentials to disk.
</Warning>

### File attachments

You can upload files (like `.npmrc`, `settings.xml`, configuration files) through the blueprint editor. Uploaded files are written to `~/.files/` and an environment variable is set pointing to each file's path:

```
$FILE_SETTINGS_XML    -> /home/ubuntu/.files/settings.xml
$FILE_NPMRC           -> /home/ubuntu/.files/.npmrc
```

The variable name is derived from the file name: uppercase, with non-alphanumeric characters replaced by underscores, prefixed with `FILE_`.

Use file attachments in your blueprint steps:

```yaml theme={null}
maintenance:
  - name: "Configure Maven"
    run: |
      mkdir -p ~/.m2
      cp "$FILE_SETTINGS_XML" ~/.m2/settings.xml
```

## Git-backed blueprints

You can store blueprints as `.devin/blueprint.yaml` files directly in your repository, then sync them via the API or the UI. See [Git-backed blueprints](/onboard-devin/environment/git-backed-blueprints) for setup instructions and details.

## Complete example

<Info>
  For how blueprints compose across tiers (enterprise → org → repo), build statuses, repository states, and what triggers a rebuild, see [Builds and sessions](/onboard-devin/environment/blueprints#builds-and-sessions) on the Declarative configuration page.
</Info>

### Org-wide blueprint

Shared tooling that every repo in the org needs. This runs first (after any enterprise blueprint), in the home directory.

```yaml theme={null}
initialize:
  - name: "Install Node.js 20"
    uses: github.com/actions/setup-node@v4
    with:
      node-version: "20"

  - name: "Install Python 3.12 and uv"
    run: |
      curl -LsSf https://astral.sh/uv/install.sh | sh

  - name: "Install shared tools"
    run: |
      npm install -g pnpm turbo
      apt-get update && apt-get install -y jq ripgrep

  - name: "Configure private registry"
    run: |
      echo "//npm.corp.example.com/:_authToken=$NPM_REGISTRY_TOKEN" >> ~/.npmrc
```

### Repo-level blueprint

Project-specific setup for a Node.js + Python monorepo. This runs after the org-wide blueprint, in the repository directory.

```yaml theme={null}
initialize:
  - name: "Install Playwright browsers"
    run: npx playwright install --with-deps chromium

  - name: "Set up project environment variables"
    run: |
      echo "DATABASE_URL=postgresql://localhost:5432/myapp_dev" >> $ENVRC
      echo "REDIS_URL=redis://localhost:6379" >> $ENVRC
      echo "APP_ENV=development" >> $ENVRC

maintenance:
  - name: "Install frontend dependencies"
    run: |
      cd frontend
      pnpm install

  - name: "Install backend dependencies"
    run: |
      cd backend
      uv sync

  - name: "Run database migrations"
    run: |
      cd backend
      uv run alembic upgrade head
    env:
      DATABASE_URL: "postgresql://localhost:5432/myapp_dev"

knowledge:
  - name: lint
    contents: |
      Frontend:
      cd frontend && pnpm lint

      Backend:
      cd backend && uv run ruff check .

      Auto-fix:
      cd frontend && pnpm lint --fix
      cd backend && uv run ruff check --fix .

  - name: test
    contents: |
      Frontend unit tests:
      cd frontend && pnpm test

      Backend unit tests:
      cd backend && uv run pytest

      E2E tests (requires dev server running):
      cd frontend && pnpm test:e2e

  - name: build
    contents: |
      Frontend:
      cd frontend && pnpm build

      Backend:
      cd backend && uv run python -m build

  - name: dev-server
    contents: |
      Start the full development stack:
      cd backend && uv run uvicorn main:app --reload &
      cd frontend && pnpm dev

      Frontend: http://localhost:3000
      Backend API: http://localhost:8000
      API docs: http://localhost:8000/docs

  - name: database
    contents: |
      Run migrations:
      cd backend && uv run alembic upgrade head

      Create a new migration:
      cd backend && uv run alembic revision --autogenerate -m "description"

      Reset the database:
      cd backend && uv run alembic downgrade base && uv run alembic upgrade head
```
