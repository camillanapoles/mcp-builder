/**
 * HookRegistry — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HookRegistry } from '../src/hooks/registry.js';
import { createLogger } from '../src/logger/index.js';
import type { HookContext, HookResult } from '../src/types.js';

function makeCtx(): HookContext {
  return {
    spec: {
      name: 'test', description: 'test spec', sdk: 'python',
      pattern: 'stateless', tools: [],
    },
    state: {
      current: 'draft', history: ['draft'],
      artifacts: [], startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    artifacts: [],
    env: {},
    git: { ref: 'main', sha: 'abc', repo: 'owner/repo' },
    logger: createLogger('error'),
  };
}

describe('HookRegistry', () => {
  let registry: HookRegistry;

  beforeEach(() => {
    registry = new HookRegistry(createLogger('error'));
  });

  it('registers a hook', () => {
    registry.register({
      name: 'test',
      category: 'gate',
      description: 'test hook',
      fn: async () => ({ ok: true }),
    });
    expect(registry.has('gate', 'test')).toBe(true);
  });

  it('throws when registering duplicate hook', () => {
    registry.register({
      name: 'test', category: 'gate', description: 'x',
      fn: async () => ({ ok: true }),
    });
    expect(() =>
      registry.register({
        name: 'test', category: 'gate', description: 'x',
        fn: async () => ({ ok: true }),
      })
    ).toThrow();
  });

  it('throws when registering unknown category', () => {
    expect(() =>
      registry.register({
        name: 'x', category: 'unknown' as never, description: 'x',
        fn: async () => ({ ok: true }),
      })
    ).toThrow();
  });

  it('runs a single hook', async () => {
    registry.register({
      name: 'test', category: 'gate', description: 'x',
      fn: async (_ctx, payload) => ({ ok: true, data: payload }),
    });
    const result = await registry.run('gate', 'test', makeCtx(), { hello: 'world' });
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ hello: 'world' });
  });

  it('throws when running unregistered hook', async () => {
    await expect(registry.run('gate', 'missing', makeCtx())).rejects.toThrow();
  });

  it('runs all hooks in a category in sequence', async () => {
    const order: string[] = [];
    registry.register({
      name: 'a', category: 'gate', description: 'x',
      fn: async () => { order.push('a'); return { ok: true }; },
    });
    registry.register({
      name: 'b', category: 'gate', description: 'x',
      fn: async () => { order.push('b'); return { ok: true }; },
    });
    const result = await registry.runCategory('gate', makeCtx());
    expect(result.ok).toBe(true);
    expect(order).toEqual(['a', 'b']);
  });

  it('short-circuits on first block', async () => {
    const order: string[] = [];
    registry.register({
      name: 'a', category: 'gate', description: 'x',
      fn: async () => { order.push('a'); return { ok: false, block: { reason: 'blocked', suggestions: [] } }; },
    });
    registry.register({
      name: 'b', category: 'gate', description: 'x',
      fn: async () => { order.push('b'); return { ok: true }; },
    });
    const result = await registry.runCategory('gate', makeCtx());
    expect(result.ok).toBe(false);
    expect(result.block?.reason).toBe('blocked');
    expect(order).toEqual(['a']); // b not called
  });

  it('returns ok:true when category is empty', async () => {
    const result = await registry.runCategory('advisor', makeCtx());
    expect(result.ok).toBe(true);
  });

  it('list returns all hooks of a category', () => {
    registry.register({
      name: 'a', category: 'gate', description: 'gate a',
      fn: async () => ({ ok: true }),
    });
    registry.register({
      name: 'b', category: 'advisor', description: 'advisor b',
      fn: async () => ({ ok: true }),
    });
    expect(registry.list('gate')).toHaveLength(1);
    expect(registry.list('advisor')).toHaveLength(1);
    expect(registry.list()).toHaveLength(2);
  });
});
