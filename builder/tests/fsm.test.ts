/**
 * FSM engine — unit tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FSM, FSMError } from '../src/fsm/index.js';
import type { FSMDefinition } from '../src/types.js';

const simpleDef: FSMDefinition = {
  states: {
    draft: { description: 'draft state', on_enter: [] },
    scaffolded: { description: 'scaffolded', on_enter: [] },
    tested: { description: 'tested', on_enter: [] },
    released: { description: 'released', terminal: true, on_enter: [] },
    failed: { description: 'failed', on_enter: [] },
    archived: { description: 'archived', terminal: true },
  },
  transitions: [
    { from: 'draft', to: 'scaffolded', event: 'scaffold.complete', action_workflow: 'scaffold.yml' },
    { from: 'scaffolded', to: 'tested', event: 'scaffold.validated', action_workflow: 'test.yml' },
    { from: 'tested', to: 'released', event: 'e2e.passed', action_workflow: 'release.yml' },
    { from: '*', to: 'failed', event: '*.failed', action_workflow: 'advisor-block.yml' },
    { from: 'failed', to: 'draft', event: 'advisor.cleared', action_workflow: 'reset.yml' },
  ],
};

describe('FSM', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM(simpleDef);
  });

  describe('basic queries', () => {
    it('hasState returns true for declared states', () => {
      expect(fsm.hasState('draft')).toBe(true);
      expect(fsm.hasState('scaffolded')).toBe(true);
      expect(fsm.hasState('released')).toBe(true);
    });

    it('hasState returns false for unknown states', () => {
      expect(fsm.hasState('nonexistent')).toBe(false);
    });

    it('isTerminal returns true for terminal states', () => {
      expect(fsm.isTerminal('released')).toBe(true);
      expect(fsm.isTerminal('archived')).toBe(true);
    });

    it('isTerminal returns false for non-terminal states', () => {
      expect(fsm.isTerminal('draft')).toBe(false);
      expect(fsm.isTerminal('scaffolded')).toBe(false);
    });
  });

  describe('validTransitions', () => {
    it('lists valid transitions from draft', () => {
      const ts = fsm.validTransitions('draft');
      expect(ts).toHaveLength(2); // explicit + wildcard
      expect(ts.some(t => t.to === 'scaffolded')).toBe(true);
      expect(ts.some(t => t.to === 'failed')).toBe(true);
    });

    it('returns empty array for terminal state', () => {
      expect(fsm.validTransitions('released')).toEqual([]);
    });

    it('throws for unknown state', () => {
      expect(() => fsm.validTransitions('nonexistent')).toThrow(FSMError);
    });
  });

  describe('transition', () => {
    it('finds exact match transition', () => {
      const ctx = FSM.initialContext();
      const t = fsm.transition(ctx, 'scaffold.complete');
      expect(t.to).toBe('scaffolded');
      expect(t.action_workflow).toBe('scaffold.yml');
    });

    it('matches wildcard event "*.failed" for any *.failed event', () => {
      const ctx = FSM.initialContext();
      const t = fsm.transition(ctx, 'scaffold.failed');
      expect(t.to).toBe('failed');
    });

    it('throws for invalid transition', () => {
      const ctx = FSM.initialContext();
      expect(() => fsm.transition(ctx, 'invalid.event')).toThrow(FSMError);
    });

    it('throws when transitioning from terminal state', () => {
      const ctx = { ...FSM.initialContext(), current: 'released' };
      expect(() => fsm.transition(ctx, 'any.event')).toThrow(FSMError);
    });
  });

  describe('apply', () => {
    it('returns new context with updated current state', () => {
      const ctx = FSM.initialContext();
      const { ctx: newCtx, transition } = fsm.apply(ctx, 'scaffold.complete');
      expect(newCtx.current).toBe('scaffolded');
      expect(newCtx.history).toContain('scaffolded');
      expect(newCtx.history).toHaveLength(2);
      expect(transition.to).toBe('scaffolded');
    });

    it('preserves immutability of original context', () => {
      const ctx = FSM.initialContext();
      fsm.apply(ctx, 'scaffold.complete');
      expect(ctx.current).toBe('draft');
      expect(ctx.history).toHaveLength(1);
    });

    it('appends artifacts to new context', () => {
      const ctx = FSM.initialContext();
      const artifact = {
        id: 'a1', name: 'test', type: 'json' as const,
        path: '/tmp/test.json', size: 100, sha: 'abc',
        workflow: 'scaffold.yml', runId: 1, createdAt: new Date().toISOString(),
      };
      const { ctx: newCtx } = fsm.apply(ctx, 'scaffold.complete', [artifact]);
      expect(newCtx.artifacts).toHaveLength(1);
      expect(newCtx.artifacts[0].id).toBe('a1');
    });
  });

  describe('initialContext', () => {
    it('starts at draft state', () => {
      const ctx = FSM.initialContext();
      expect(ctx.current).toBe('draft');
    });

    it('has draft in history', () => {
      const ctx = FSM.initialContext();
      expect(ctx.history).toEqual(['draft']);
    });

    it('has empty artifacts', () => {
      const ctx = FSM.initialContext();
      expect(ctx.artifacts).toEqual([]);
    });
  });

  describe('toMermaid', () => {
    it('generates valid stateDiagram-v2 syntax', () => {
      const mermaid = fsm.toMermaid();
      expect(mermaid).toContain('stateDiagram-v2');
      expect(mermaid).toContain('[*] --> draft');
      expect(mermaid).toContain('draft --> scaffolded: scaffold.complete');
      expect(mermaid).toContain('released --> [*]');
    });

    it('excludes wildcard transitions from diagram', () => {
      const mermaid = fsm.toMermaid();
      // wildcard "* --> failed" should not appear as explicit arrow
      expect(mermaid).not.toMatch(/\* --> failed/);
    });
  });
});
