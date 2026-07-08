/**
 * HookRegistry — gerencia os 5 hooks canônicos (gate/trigger/event/monitor/advisor).
 *
 * Carregado por:
 * - CLI (modo normal: todos os 5)
 * - MCP server (configurável por tool)
 * - HTTP API (configurável por endpoint)
 * - GitHub Action (modo strict: todos os 5)
 *
 * Plugins de terceiros podem registrar hooks customizados via register().
 */

import type {
  Hook,
  HookCategory,
  HookContext,
  HookDescriptor,
  HookResult,
  Logger,
} from '../types.js';

export class HookRegistry {
  private readonly hooks: Map<HookCategory, Map<string, Hook>> = new Map();
  private readonly descriptors: Map<string, HookDescriptor> = new Map();

  constructor(private logger: Logger) {
    for (const cat of ['gate', 'trigger', 'event', 'monitor', 'advisor'] as HookCategory[]) {
      this.hooks.set(cat, new Map());
    }
  }

  /**
   * Registra um hook.
   */
  register(desc: HookDescriptor): void {
    const cat = this.hooks.get(desc.category);
    if (!cat) {
      throw new Error(`unknown hook category: ${desc.category}`);
    }
    if (cat.has(desc.name)) {
      throw new Error(`hook ${desc.category}/${desc.name} already registered`);
    }
    cat.set(desc.name, desc.fn);
    this.descriptors.set(`${desc.category}/${desc.name}`, desc);
    this.logger.debug('hook registered', { category: desc.category, name: desc.name });
  }

  /**
   * Executa TODOS hooks de uma categoria, em sequência.
   * Para no primeiro que retornar { ok: false, block }.
   */
  async runCategory(
    category: HookCategory,
    ctx: HookContext,
    payload?: unknown,
  ): Promise<HookResult> {
    const cat = this.hooks.get(category);
    if (!cat || cat.size === 0) {
      return { ok: true };
    }

    let lastResult: HookResult = { ok: true };
    for (const [name, fn] of cat) {
      this.logger.debug('running hook', { category, name });
      const result = await fn(ctx, payload);
      lastResult = result;
      if (!result.ok && result.block) {
        this.logger.warn('hook blocked', {
          category, name,
          reason: result.block.reason,
        });
        return result; // short-circuit
      }
    }
    return lastResult;
  }

  /**
   * Executa um hook específico.
   */
  async run(
    category: HookCategory,
    name: string,
    ctx: HookContext,
    payload?: unknown,
  ): Promise<HookResult> {
    const cat = this.hooks.get(category);
    const fn = cat?.get(name);
    if (!fn) {
      throw new Error(`hook ${category}/${name} not registered`);
    }
    return fn(ctx, payload);
  }

  /**
   * Lista hooks de uma categoria (para introspecção pelo agente).
   */
  list(category?: HookCategory): HookDescriptor[] {
    if (category) {
      const result: HookDescriptor[] = [];
      for (const [key, desc] of this.descriptors) {
        if (key.startsWith(`${category}/`)) result.push(desc);
      }
      return result;
    }
    return Array.from(this.descriptors.values());
  }

  /**
   * Verifica se um hook está registrado.
   */
  has(category: HookCategory, name: string): boolean {
    return this.hooks.get(category)?.has(name) ?? false;
  }
}
