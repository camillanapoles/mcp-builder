> ## Documentation Index
> Fetch the complete documentation index at: https://docs.devin.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Declarative configuration

> Define your environment in YAML blueprints. Builds run automatically to produce snapshots that every session boots from.

## Getting started

<Info>
  **Prerequisites**: Devin must have access to your repositories before you can configure its environment. If you haven't set up your Git integration yet, see [Before you start](/onboard-devin/environment#before-you-start) for setup steps. Enterprise users also need to grant each org access to its repos in **Enterprise Settings > Repository Permissions**.
</Info>

<Info>
  **Still on classic configuration?** You can migrate to declarative configuration at any time. Devin can handle most of the migration for you. See [Migrating to declarative configuration](/onboard-devin/environment/migration).
</Info>

<Tabs>
  <Tab title="Let Devin do it (recommended)">
    Best for most users. Devin analyzes your project, figures out what tools and dependencies are needed, and generates the blueprint for you. You just review and approve.

    <Steps>
      <Step title="Start a Devin session">
        Open a new session and ask Devin to configure the repository. For example: *"Set up your environment for this repo."*
      </Step>

      <Step title="Review and approve">
        Devin proposes a blueprint. You'll see **suggestion cards** in your timeline. Review them and click **Approve**.
      </Step>

      <Step title="Verify">
        Once the build completes, start a new session. Devin boots from the new snapshot with everything pre-configured. Try asking Devin to run your lint or test commands to confirm everything works.
      </Step>
    </Steps>
  </Tab>

  <Tab title="Manual setup">
    Best when you know exactly what your environment needs, or want full control over every step. Faster if you already have your commands ready.

    <Steps>
      <Step title="Navigate to environment configuration">
        Go to **Settings > Environment > Blueprints** in your organization's sidebar.

        If you don't see this option, your organization may still be on classic setup. See [Migrating to declarative configuration](/onboard-devin/environment/migration) to get started.
      </Step>

      <Step title="Add repositories">
        Click **Add** in the Repositories section. Select the repositories you want Devin to work with, then confirm.

        Repositories added here are cloned into Devin's environment during each build. You can add more at any time.
      </Step>

      <Step title="Write your blueprint">
        Click on a repository to open its blueprint editor. Here's a simple example:

        ```yaml theme={null}
        initialize: |
          curl -LsSf https://astral.sh/uv/install.sh | sh

        maintenance: |
          uv sync

        knowledge:
          - name: lint
            contents: uv run ruff check .
          - name: test
            contents: uv run pytest
        ```

        For more languages and patterns, see the [Template library](/onboard-devin/environment/templates).
      </Step>

      <Step title="Save and build">
        Click **Save**. A build starts automatically (typically 2–10 minutes). Monitor progress from **Settings > Environment > Snapshots** under **Current build**.
      </Step>

      <Step title="Verify">
        Once the build shows **Success**, start a new Devin session. Devin boots from the new snapshot with everything pre-configured. Try asking Devin to run your lint or test commands to verify the environment works.
      </Step>
    </Steps>
  </Tab>
</Tabs>

The rest of this guide covers the manual path in detail. It's also useful for understanding what Devin generated if you used the recommended path.

## How it works

Declarative configuration uses three concepts:

| Concept       | What it is                                                                                | Analogy        |
| ------------- | ----------------------------------------------------------------------------------------- | -------------- |
| **Blueprint** | A YAML configuration that describes what to install and how to set up Devin's environment | Dockerfile     |
| **Build**     | The process that runs your blueprint, clones repos, and produces a snapshot               | `docker build` |
| **Snapshot**  | A frozen, bootable image of the environment that sessions start from                      | Docker image   |

**Blueprints describe what you want.** You author them and edit them in the Settings UI.

**Builds run your blueprints to produce snapshots.** Builds run automatically when you save a blueprint and periodically (\~every 24 hours) to keep dependencies fresh.

**Snapshots are what sessions boot from.** Each organization has one active snapshot. Every session boots a fresh copy. Session changes don't persist back to the snapshot.

### Blueprint sections

A blueprint has three sections, plus an optional `clone` block for repo-level blueprints:

| Section       | Purpose                                                          | When it runs                                                               |
| ------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `initialize`  | Install tools, runtimes, system packages                         | During builds only. Results are saved in the snapshot.                     |
| `maintenance` | Install/update project dependencies, write credential configs    | During builds. Surfaced to the agent at session start (not auto-executed). |
| `knowledge`   | Reference info for Devin (lint, test, build commands)            | Not executed. Loaded into Devin's context at session start.                |
| `clone`       | Override git-clone defaults for the repository (repo-level only) | Applied during the build's clone step.                                     |

**`initialize`** is for things that only need to happen once: language runtimes, system packages, global CLI tools.

**`maintenance`** is for dependency installation that should stay current. It runs during builds and is surfaced to the agent at session start so it can re-run them if dependencies have changed (e.g. after pulling latest code). Commands are not auto-executed at session start, but should still be fast and incremental (use `npm install`, not `npm ci`).

**`knowledge`** is reference information, not executed. This is how you tell Devin the correct commands for linting, testing, and building. Keep entries lightweight and focused on executable commands.

**`clone`** (repo-level only) overrides defaults Devin uses when cloning the repo into the snapshot — for example, checking out a non-default branch (`ref`), changing the clone destination (`path`), or skipping submodules or LFS objects. Every field is optional. See [Blueprint reference → clone](/onboard-devin/environment/blueprint-reference#clone) for the full field list.

<Info>
  **Knowledge here vs the Knowledge product feature:** The `knowledge` section in your blueprint is for short command references tied to the environment. For architecture docs, conventions, and team workflows, use the standalone [Knowledge](/product-guides/knowledge) feature instead.
</Info>

<Info>
  **Multi-document YAML:** The blueprint editor supports multi-document YAML using the `---` separator. This lets you organize complex blueprints into logical sections within a single editor.
</Info>

For the complete field specification (step types, environment variables, secrets, and file attachments), see the [Blueprint reference](/onboard-devin/environment/blueprint-reference).

### Blueprint scope

You can define blueprints at two levels:

| Level            | Where to configure                                   | What to put here                                                                |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Organization** | Settings > Environment > Blueprints > Org-wide setup | Tools shared across all repos: language runtimes, package managers, Docker auth |
| **Repository**   | Settings > Environment > Blueprints > \[repo name]   | Project-specific setup: `npm install`, lint/test/build commands                 |

Blueprints are **additive**: repo blueprints build on top of the org blueprint. A repo's `maintenance` can use tools installed by the org's `initialize`. If only one repo needs a tool, put it in that repo's blueprint. If every repo needs it, put it in the org blueprint.

<Info>
  **Enterprise users:** There's a third tier, the enterprise blueprint, that applies across all organizations. See [Enterprise environment overview](/enterprise/environment-management/overview) for details.
</Info>

## Builds and sessions

### The snapshot

Your organization has **one active snapshot**: a VM image with your tools, repos, and dependencies pre-installed. All configured repos are cloned and set up in that single image. Every session boots from a fresh copy.

### How builds work

A build creates a new snapshot by running your blueprints in sequence:

```
1. Enterprise blueprint, if configured (runs in ~):
   a. initialize
   b. maintenance
2. Org blueprint (runs in ~):
   a. initialize
   b. maintenance
3. Clone all repositories (up to 10 concurrent).
   Each repo's blueprint may override clone defaults via the
   `clone` block (branch/tag, depth, submodules, LFS, etc.).
4. For each configured repo, in the order shown in Settings
   (runs in ~/repos/<repo-name>):
   a. initialize
   b. maintenance
5. Health check, then snapshot is saved
```

Layers are **additive**: repo-specific commands can use tools installed by the org or enterprise blueprint. Lower levels cannot override what a higher level set up. Builds typically take 5–15 minutes. Individual steps time out after 1 hour.

### How sessions work

Each session boots a **fresh copy** of the snapshot. When the session ends, all changes are discarded. At session start:

1. The latest code is pulled for the relevant repo(s).
2. `maintenance` commands (enterprise, org, and repo) are surfaced to the agent as context — **not auto-executed**. The agent may re-run them if it detects dependencies have changed since the last build.
3. That repo's `knowledge` entries are loaded into Devin's context.

<Info>
  **Knowledge is per-repo.** If you have 5 repos configured, Devin only sees the knowledge entries for the one it's working on.
</Info>

### What triggers a build

| Trigger                         | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| Saving a blueprint              | Creating, updating, or deleting a blueprint        |
| Adding or removing a repository | Any change to the repository list                  |
| Adding a repository secret      | New secrets require a rebuild to be available      |
| Manual trigger                  | Clicking **Build snapshot** in the UI              |
| Periodic refresh                | Automatic, roughly every 24 hours                  |
| Devin suggestion                | Devin proposes a blueprint change during a session |

Only one build runs at a time. New triggers cancel any queued build and start fresh.

### Build statuses

| Status        | Meaning                                                                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Success**   | All steps completed. Snapshot is ready.                                                                                                      |
| **Partial**   | Some repo-level steps failed, but the snapshot is usable. Repos that succeeded work normally; repos that failed need their blueprints fixed. |
| **Failed**    | Critical failure (org or enterprise setup failed). Snapshot is not usable.                                                                   |
| **Cancelled** | Superseded by a newer build or manually cancelled.                                                                                           |

A **partial** build still produces a working snapshot. If one of five repos has a broken blueprint, the other four are fully functional.

<Tip>
  **Build failing?** See [Troubleshooting builds](#troubleshooting-builds) for a step-by-step debugging guide.
</Tip>

## Managing your environment

### Repository states

Repositories appear in three states in the Environment settings:

| State          | Meaning                                                                              |
| -------------- | ------------------------------------------------------------------------------------ |
| **Configured** | Has a blueprint with initialize/maintenance/knowledge. Fully set up in the snapshot. |
| **Included**   | Cloned into the snapshot but has no custom blueprint. Devin can access the code.     |
| **Available**  | Connected to the org but not added to the environment. Not cloned.                   |

**Included vs. configured:** An "included" repo is cloned so Devin can access the code, but has no custom setup commands. A "configured" repo has explicit initialize/maintenance/knowledge instructions.

### Secrets

Reference secrets with `$VARIABLE_NAME` syntax. Add them in the **Secrets** tab within the blueprint editor.

```yaml theme={null}
maintenance:
  - name: Configure private registry
    run: npm config set //registry.npmjs.org/:_authToken $NPM_TOKEN
```

Secrets are available as environment variables during builds and sessions. They are removed before the snapshot is saved, but if a command writes a secret value into a config file during `initialize`, that value persists in the snapshot. Place credential-writing steps in `maintenance` so they are refreshed during periodic builds.

For details on secret scopes and behavior, see the [Blueprint reference](/onboard-devin/environment/blueprint-reference#environment-variables-and-secrets).

### Multiple repositories

Each repo gets its own blueprint. During a build, all repos are set up in the same snapshot, cloned into separate directories with dependencies installed independently.

If two repos install different versions of a global tool or modify shared files (like `~/.bashrc`), the last one to run wins. Put shared tool installs in the org-wide blueprint to avoid conflicts.

### GitHub Actions

Instead of writing shell scripts to install tools and runtimes, you can reference GitHub Actions directly in your blueprint. Devin downloads and runs the action during the build, the same way GitHub's CI runners execute action steps.

```yaml theme={null}
initialize:
  - name: Install Python 3.12
    uses: github.com/actions/setup-python@v5
    with:
      python-version: "3.12"
```

This is especially useful for language setup actions like `setup-python`, `setup-node`, and `setup-go`, which handle version management and PATH configuration automatically.

For syntax details, examples, and limitations, see [GitHub Actions in blueprints](/onboard-devin/environment/github-actions).

### Monorepos

You can run commands in subdirectories using subshells, or create dedicated workspace-scoped blueprints for individual packages. Devin also supports per-package knowledge entries so each workspace gets its own lint, test, and build commands.

See [Workspaces and monorepos](/onboard-devin/environment/workspaces) for setup instructions and examples.

### Pinning and auto-updates

By default, Devin uses the latest successful build's snapshot. **Pinning** lets you lock to a specific build's snapshot. This is useful when a new build introduces a regression, or when you want to freeze the environment for a batch of sessions.

**To pin:** Go to **Settings > Environment > Snapshots**, find the build in history (must be `success` or `partial`, less than 7 days old), and click **Pin**. While pinned, periodic refreshes are skipped and the UI shows **Auto-updates paused**.

**To unpin:** Click **Resume auto-updates**. Devin switches to the latest successful build.

### Git-backed blueprints

You can store blueprints as `.devin/blueprint.yaml` files directly in your repository. After merging changes, call the sync API (or click Sync in the UI) to update the blueprint, then trigger a build. This gives you the same code-review workflow you use for application code, with sync automated via a CI step.

See [Git-backed blueprints](/onboard-devin/environment/git-backed-blueprints) for setup instructions and details.

## Troubleshooting builds

### Initialize step failed

**Common causes:** typo in a shell command, package not available, network timeout, incorrect GitHub Action reference.

**Fix:** Check build logs for the exact error. Update `initialize` in your blueprint and save. A new build triggers automatically.

### Repository clone failed

**Common causes:** Devin doesn't have access to the repo, repo was renamed/moved/deleted, transient network issue.

**Fix:** Verify repo access in your Git provider settings. Remove and re-add the repo if it was renamed.

### Maintenance step failed

**Common causes:** dependency conflict, missing system library, disk space exhaustion, lock file out of sync.

**Fix:** Check logs for the failing package/command. Update `maintenance` or `initialize` to install missing dependencies, or fix the lock file in your repository.

### Build timeout

Each step has a 1-hour timeout. Common causes: compiling large native dependencies from source (use pre-built binaries), downloading large artifacts, commands that hang waiting for input (all commands must be non-interactive).

### Iterating on fixes

1. Check build logs to identify the failure
2. Update the relevant blueprint
3. Save (a new build triggers automatically)
4. Monitor the new build's logs
5. Repeat until the build succeeds

<Info>
  You don't need to wait for a failed build to finish. Saving a new configuration cancels any queued build and starts fresh.
</Info>

## Next steps

<CardGroup cols={2}>
  <Card title="Differential builds" icon="bolt" href="/onboard-devin/environment/differential-builds">
    Speed up builds by only rebuilding workspaces whose blueprints changed.
  </Card>

  <Card title="GitHub Actions in blueprints" icon="github" href="/onboard-devin/environment/github-actions">
    Use GitHub Actions to install languages, tools, and SDKs without writing shell scripts.
  </Card>

  <Card title="Workspaces and monorepos" icon="folder-tree" href="/onboard-devin/environment/workspaces">
    Subshells, workspace scopes, and knowledge entries for multi-package repositories.
  </Card>

  <Card title="Blueprint reference" icon="book" href="/onboard-devin/environment/blueprint-reference">
    Complete field reference: step types, environment variables, secrets, file attachments.
  </Card>

  <Card title="Template library" icon="copy" href="/onboard-devin/environment/templates">
    Copy-paste blueprints for Python, Node.js, Go, Java, Ruby, Rust, and advanced patterns.
  </Card>

  <Card title="Git-backed blueprints" icon="code-branch" href="/onboard-devin/environment/git-backed-blueprints">
    Store blueprints in your repo as `.devin/blueprint.yaml` and sync via the API or UI.
  </Card>

  <Card title="Migrating from classic setup" icon="arrow-right" href="/onboard-devin/environment/migration">
    Step-by-step guide to move from the interactive wizard to declarative blueprints.
  </Card>

  <Card title="Enterprise environment management" icon="building" href="/enterprise/environment-management/overview">
    Enterprise-wide environment management: 3-tier hierarchy, secrets, and cross-org configuration.
  </Card>
</CardGroup>
