/**
 * EVENT hooks — roteamento pub/sub entre eventos e handlers.
 *
 * Padrão PDCA: Do (parte 2 — roteamento).
 *
 * Events built-in:
 *   - scaffold.requested   → dispara scaffold.yml
 *   - scaffold.complete    → transição draft→scaffolded
 *   - tests.requested      → dispara test.yml
 *   - tests.passed         → transição tested→validated
 *   - tests.failed         → transição tested→failed (curinga)
 *   - e2e.passed           → transição validated→released
 *   - release.complete     → notifica stakeholders
 *   - advisor.cleared      → transição failed→draft (recuperação)
 */

import type { Hook, HookContext } from '../types.js';

type EventHandler = (payload: unknown, ctx: HookContext) => Promise<void>;

class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();

  subscribe(event: string, handler: EventHandler): () => void {
    if (event === '*') {
      this.wildcardHandlers.add(handler);
      return () => this.wildcardHandlers.delete(handler);
    }
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set!.delete(handler);
  }

  async publish(event: string, payload: unknown, ctx: HookContext): Promise<void> {
    // handlers específicos
    const set = this.handlers.get(event);
    if (set) {
      for (const h of set) await h(payload, ctx);
    }

    // curingas: "*.failed" captura "x.failed"
    for (const [pattern, handlers] of this.handlers) {
      if (pattern.endsWith('.failed') && event.endsWith('.failed')) {
        for (const h of handlers) await h(payload, ctx);
      }
    }

    // wildcards globais
    for (const h of this.wildcardHandlers) {
      await h(payload, ctx);
    }
  }
}

const globalBus = new EventBus();

export const eventBus = globalBus;

export const routeEvent: Hook<{ event: string; payload?: unknown }> = async (ctx, p) => {
  await globalBus.publish(p.event, p.payload ?? {}, ctx);
  return { ok: true, data: { routed: true, event: p.event } };
};

export const subscribeEvent: Hook<{ event: string; handler: EventHandler }> =
  async (_ctx, p) => {
    const unsubscribe = globalBus.subscribe(p.event, p.handler);
    return { ok: true, data: { subscribed: true, unsubscribe } };
  };

/**
 * Lista de eventos canônicos do FSM. Útil para validação e documentação.
 */
export const CANONICAL_EVENTS = [
  'scaffold.requested',
  'scaffold.complete',
  'scaffold.validated',
  'scaffold.failed',
  'tests.requested',
  'tests.passed',
  'tests.failed',
  'e2e.passed',
  'e2e.failed',
  'release.complete',
  'release.failed',
  'advisor.cleared',
  'advisor.blocked',
  'manual.archive',
] as const;

export type CanonicalEvent = typeof CANONICAL_EVENTS[number];

export function isCanonicalEvent(event: string): event is CanonicalEvent {
  return (CANONICAL_EVENTS as readonly string[]).includes(event);
}
