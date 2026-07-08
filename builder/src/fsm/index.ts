/**
 * FSM Engine — Máquina de Estados GitOps
 *
 * Lê states.yaml e transitions.yaml do repo (source of truth determinístico)
 * e implementa transições respeitando o alfabeto de eventos declarado.
 *
 * Esta engine NÃO persiste estado — ela apenas valida e computa transições.
 * Persistência é responsabilidade do workflow GitHub Action (via artifacts).
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type {
  FSMContext,
  FSMDefinition,
  FSMState,
  FSMTransition,
  Artifact,
} from '../types.js';

export class FSMError extends Error {
  constructor(
    message: string,
    public readonly code: 'INVALID_TRANSITION' | 'UNKNOWN_STATE' | 'UNKNOWN_EVENT' | 'NOT_TERMINAL' | 'ALREADY_TERMINAL',
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'FSMError';
  }
}

export class FSM {
  private readonly states: Map<string, FSMState>;
  private readonly transitions: FSMTransition[];

  constructor(definition: FSMDefinition) {
    this.states = new Map(Object.entries(definition.states));
    this.transitions = definition.transitions;
  }

  /**
   * Cria contexto inicial para uma nova instância FSM.
   */
  static initialContext(): FSMContext {
    const now = new Date().toISOString();
    return {
      current: 'draft',
      history: ['draft'],
      artifacts: [],
      startedAt: now,
      updatedAt: now,
    };
  }

  /**
   * Carrega FSM a partir de arquivos YAML versionados no repo.
   */
  static async fromRepo(repoRoot: string): Promise<FSM> {
    const statesPath = join(repoRoot, '.mcp', 'state', 'states.yaml');
    const transitionsPath = join(repoRoot, '.mcp', 'state', 'transitions.yaml');

    if (!existsSync(statesPath)) {
      throw new FSMError(
        `states.yaml not found at ${statesPath}`,
        'UNKNOWN_STATE',
        { path: statesPath },
      );
    }

    const statesRaw = await readFile(statesPath, 'utf8');
    const transitionsRaw = await readFile(transitionsPath, 'utf8');

    const statesDoc = parseYaml(statesRaw) as { states: Record<string, FSMState> };
    const transitionsDoc = parseYaml(transitionsRaw) as { transitions: FSMTransition[] };

    return new FSM({
      states: statesDoc.states,
      transitions: transitionsDoc.transitions,
    });
  }

  hasState(name: string): boolean {
    return this.states.has(name);
  }

  isTerminal(name: string): boolean {
    return this.states.get(name)?.terminal ?? false;
  }

  validTransitions(from: string): FSMTransition[] {
    if (!this.hasState(from)) {
      throw new FSMError(`unknown state: ${from}`, 'UNKNOWN_STATE', { state: from });
    }
    if (this.isTerminal(from)) {
      return [];
    }
    return this.transitions.filter(t => t.from === from || t.from === '*');
  }

  transition(ctx: FSMContext, event: string): FSMTransition {
    if (this.isTerminal(ctx.current)) {
      throw new FSMError(
        `state ${ctx.current} is terminal`,
        'ALREADY_TERMINAL',
        { state: ctx.current },
      );
    }

    const exact = this.transitions.find(
      t => t.from === ctx.current && t.event === event,
    );
    if (exact) return exact;

    const wildcardEvent = this.transitions.find(
      t => t.from === ctx.current && t.event === '*',
    );
    if (wildcardEvent) return wildcardEvent;

    const wildcardFrom = this.transitions.find(
      t => t.from === '*' && t.event === event,
    );
    if (wildcardFrom) return wildcardFrom;

    if (event.endsWith('.failed')) {
      const failureTransition = this.transitions.find(
        t => t.from === '*' && t.event === '*.failed',
      );
      if (failureTransition) return failureTransition;
    }

    throw new FSMError(
      `no transition from ${ctx.current} on event ${event}`,
      'INVALID_TRANSITION',
      { from: ctx.current, event },
    );
  }

  apply(ctx: FSMContext, event: string, artifacts: Artifact[] = []): {
    ctx: FSMContext;
    transition: FSMTransition;
  } {
    const t = this.transition(ctx, event);
    const newCtx: FSMContext = {
      ...ctx,
      current: t.to,
      history: [...ctx.history, t.to],
      artifacts: [...ctx.artifacts, ...artifacts],
      updatedAt: new Date().toISOString(),
    };
    return { ctx: newCtx, transition: t };
  }

  toMermaid(): string {
    const lines: string[] = ['stateDiagram-v2'];
    lines.push('    [*] --> draft');

    for (const t of this.transitions) {
      if (t.from === '*') continue;
      const label = `${t.event}`;
      lines.push(`    ${t.from} --> ${t.to}: ${label}`);
    }

    for (const [name, state] of this.states) {
      if (state.terminal) {
        lines.push(`    ${name} --> [*]`);
      }
    }

    return lines.join('\n');
  }
}
