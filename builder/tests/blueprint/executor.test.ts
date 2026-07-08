/**
 * Blueprint executor — tests
 *
 * Nota: testes focam em parsing/normalização e em execução de steps `run`
 * simples. Não testa actions `uses` (que requerem rede ou action runner).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { BlueprintExecutor, hashBlueprint } from '../../src/blueprint/executor.js';
import { parseBlueprint } from '../../src/blueprint/parser.js';
import type { Blueprint, BlueprintContext } from '../../src/blueprint/types.js';

const TEST_WORKDIR = join(tmpdir(), `mcp-builder-test-${Date.now()}`);

function makeContext(workdir: string = TEST_WORKDIR): BlueprintContext {
  return BlueprintExecutor.createContext({
    scope: 'repository',
    workdir,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

describe('BlueprintExecutor', () => {
  beforeEach(async () => {
    await mkdir(TEST_WORKDIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_WORKDIR, { recursive: true, force: true });
  });

  describe('execute — run steps', () => {
    it('executes simple run step successfully', async () => {
      const bp = parseBlueprint(`
name: test
initialize:
  - name: Hello step
    run: echo "hello world"
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].ok).toBe(true);
      expect(result.steps[0].stdout).toContain('hello world');
      expect(result.steps[0].exitCode).toBe(0);
    });

    it('captures stderr from failing step', async () => {
      const bp = parseBlueprint(`
name: test
initialize:
  - name: Failing step
    run: |
      echo "going to fail" >&2
      exit 42
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(false);
      expect(result.steps[0].ok).toBe(false);
      expect(result.steps[0].exitCode).toBe(42);
      expect(result.steps[0].stderr).toContain('going to fail');
    });

    it('stops execution on first failure', async () => {
      const bp = parseBlueprint(`
name: test
initialize:
  - name: Step 1
    run: echo "step 1"
  - name: Failing step
    run: exit 1
  - name: Step 3 (should not run)
    run: echo "should not see this"
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(false);
      expect(result.steps).toHaveLength(2); // parou no segundo
      expect(result.steps[1].name).toBe('Failing step');
    });

    it('runs maintenance after initialize', async () => {
      const bp = parseBlueprint(`
name: test
initialize:
  - run: echo "init"
maintenance:
  - run: echo "maint"
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps).toHaveLength(2);
      expect(result.steps[0].stdout).toContain('init');
      expect(result.steps[1].stdout).toContain('maint');
    });

    it('extracts knowledge without executing', async () => {
      const bp = parseBlueprint(`
name: test
knowledge:
  - name: lint
    contents: npm run lint
  - name: test
    contents: npm test
`);
      const executor = new BlueprintExecutor(makeContext());
      const knowledge = executor.extractKnowledge(bp);

      expect(knowledge).toHaveLength(2);
      expect(knowledge[0].name).toBe('lint');
      expect(knowledge[1].name).toBe('test');

      // execute should not fail and should run 0 steps
      const result = await executor.execute(bp);
      expect(result.ok).toBe(true);
      expect(result.steps).toHaveLength(0);
    });
  });

  describe('execute — env vars', () => {
    it('passes step-level env vars to run', async () => {
      const bp = parseBlueprint(`
name: test
initialize:
  - name: Echo env
    run: echo "FOO=$FOO"
    env:
      FOO: bar-value
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps[0].stdout).toContain('FOO=bar-value');
    });

    it('passes secrets as env vars', async () => {
      const ctx = BlueprintExecutor.createContext({
        scope: 'repository',
        workdir: TEST_WORKDIR,
        secrets: { MY_SECRET: 'super-secret-value' },
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });
      const bp = parseBlueprint(`
name: test
initialize:
  - run: echo "secret=$MY_SECRET"
`);
      const executor = new BlueprintExecutor(ctx);
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps[0].stdout).toContain('secret=super-secret-value');
    });
  });

  describe('execute — ENVRC propagation', () => {
    it('propagates env vars across steps via $MCP_ENVRC', async () => {
      // step 1 writes to ENVRC; step 2 reads from it
      const bp = parseBlueprint(`
name: test
initialize:
  - name: Set var
    run: |
      echo 'export SHARED_VAR="hello-from-step-1"' >> $MCP_ENVRC
  - name: Read var
    run: |
      source $MCP_ENVRC
      echo "SHARED_VAR=$SHARED_VAR"
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps[1].stdout).toContain('SHARED_VAR=hello-from-step-1');
    });
  });

  describe('execute — post-build scope validation', () => {
    it('skips post-build in repository scope', async () => {
      const bp = parseBlueprint(`
name: test
post-build: |
  echo "should not run"
`);
      const executor = new BlueprintExecutor(makeContext());
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps).toHaveLength(0); // post-build skipped
    });

    it('runs post-build in organization scope', async () => {
      const orgCtx = BlueprintExecutor.createContext({
        scope: 'organization',
        workdir: TEST_WORKDIR,
        logger: { info: () => {}, warn: () => {}, error: () => {} },
      });
      const bp = parseBlueprint(`
name: test
post-build: |
  echo "post-build running"
`, 'organization');
      const executor = new BlueprintExecutor(orgCtx);
      const result = await executor.execute(bp);

      expect(result.ok).toBe(true);
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].stdout).toContain('post-build running');
    });
  });

  describe('hashBlueprint', () => {
    it('produces stable hash for identical blueprint', () => {
      const yaml = `
name: test
initialize:
  - run: echo hi
`;
      const bp1 = parseBlueprint(yaml);
      const bp2 = parseBlueprint(yaml);
      expect(hashBlueprint(bp1)).toBe(hashBlueprint(bp2));
    });

    it('produces different hash for different blueprint', () => {
      const bp1 = parseBlueprint(`name: a\ninitialize:\n  - run: echo hi`);
      const bp2 = parseBlueprint(`name: b\ninitialize:\n  - run: echo hi`);
      expect(hashBlueprint(bp1)).not.toBe(hashBlueprint(bp2));
    });

    it('hash changes when knowledge changes (knowledge affects hash)', () => {
      const bp1 = parseBlueprint(`name: t\nknowledge:\n  - name: a\n    contents: x`);
      const bp2 = parseBlueprint(`name: t\nknowledge:\n  - name: b\n    contents: x`);
      expect(hashBlueprint(bp1)).not.toBe(hashBlueprint(bp2));
    });
  });

  describe('serializeBlueprint', () => {
    it('round-trips parse → serialize', async () => {
      const { serializeBlueprint } = await import('../../src/blueprint/parser.js');
      const yaml = `
name: test
initialize:
  - run: echo hi
knowledge:
  - name: lint
    contents: npm run lint
`;
      const bp = parseBlueprint(yaml);
      const serialized = serializeBlueprint(bp);
      const reparsed = parseBlueprint(serialized);

      expect(reparsed.initialize).toEqual(bp.initialize);
      expect(reparsed.knowledge).toEqual(bp.knowledge);
    });
  });
});
