/**
 * Blueprint parser — lê e valida YAML blueprints no formato Devin-style.
 *
 * Suporta:
 * - Forma simples (block scalar string = único step com `run`)
 * - Forma estruturada (lista de steps com `name`/`run`/`uses`/`with`/`env`)
 * - Multi-document YAML (separator `---`)
 *
 * Não usa Devin. Apenas adota a mesma semântica declarativa.
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { readFileSync } from 'node:fs';
import type { Blueprint, Step } from './types.js';

export class BlueprintParseError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly line?: number,
  ) {
    super(message);
    this.name = 'BlueprintParseError';
  }
}

/**
 * Normaliza uma seção que pode ser string OU Step[].
 * - string → [{ run: <string> }]
 * - Step[] → mantém
 */
function normalizeSection(section: unknown, sectionName: string): Step[] | undefined {
  if (section === undefined || section === null) return undefined;
  if (typeof section === 'string') {
    return [{ run: section }];
  }
  if (Array.isArray(section)) {
    return section.map((s, i) => normalizeStep(s, `${sectionName}[${i}]`));
  }
  throw new BlueprintParseError(
    `${sectionName} must be string or Step[], got ${typeof section}`,
  );
}

function normalizeStep(s: unknown, ctx: string): Step {
  if (typeof s !== 'object' || s === null) {
    throw new BlueprintParseError(`${ctx} must be an object`);
  }
  const step = s as Record<string, unknown>;

  if (typeof step.run === 'string') {
    return {
      ...(typeof step.name === 'string' ? { name: step.name } : {}),
      run: step.run,
      ...(isObject(step.env) ? { env: step.env as Record<string, string> } : {}),
    };
  }

  if (typeof step.uses === 'string') {
    // validar formato: github.com/<owner>/<repo>[@<ref>]
    if (!step.uses.startsWith('github.com/')) {
      throw new BlueprintParseError(
        `${ctx}.uses must start with 'github.com/' (got: ${step.uses})`,
      );
    }
    if (!/@[\w.-]+/.test(step.uses)) {
      throw new BlueprintParseError(
        `${ctx}.uses must end with @<ref> (got: ${step.uses})`,
      );
    }
    return {
      ...(typeof step.name === 'string' ? { name: step.name } : {}),
      uses: step.uses,
      ...(isObject(step.with) ? { with: step.with as Record<string, unknown> } : {}),
      ...(isObject(step.env) ? { env: step.env as Record<string, string> } : {}),
    };
  }

  throw new BlueprintParseError(`${ctx} must have either 'run' or 'uses'`);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeKnowledge(k: unknown): Blueprint['knowledge'] {
  if (k === undefined || k === null) return undefined;
  if (!Array.isArray(k)) {
    throw new BlueprintParseError('knowledge must be an array');
  }
  return k.map((entry, i) => {
    if (!isObject(entry)) {
      throw new BlueprintParseError(`knowledge[${i}] must be an object`);
    }
    if (typeof entry.name !== 'string') {
      throw new BlueprintParseError(`knowledge[${i}].name must be string`);
    }
    if (typeof entry.contents !== 'string') {
      throw new BlueprintParseError(`knowledge[${i}].contents must be string`);
    }
    return { name: entry.name, contents: entry.contents };
  });
}

function normalizeClone(c: unknown): Blueprint['clone'] {
  if (c === undefined || c === null) return undefined;
  if (!isObject(c)) {
    throw new BlueprintParseError('clone must be an object');
  }
  const out: NonNullable<Blueprint['clone']> = {};
  if (typeof c.path === 'string') out.path = c.path;
  if (typeof c.ref === 'string') out.ref = c.ref;
  if (typeof c.depth === 'number') out.depth = c.depth;
  if (typeof c.tags === 'boolean') out.tags = c.tags;
  if (typeof c.submodules === 'boolean' || c.submodules === 'recursive') {
    out.submodules = c.submodules;
  }
  if (typeof c.lfs === 'boolean') out.lfs = c.lfs;
  return out;
}

/**
 * Parse um blueprint YAML string.
 * Suporta multi-document (separator `---`) — retorna array.
 */
export function parseBlueprint(yaml: string, scope: Blueprint['scope'] = 'repository'): Blueprint {
  const doc = parseYaml(yaml);
  if (!isObject(doc)) {
    throw new BlueprintParseError('blueprint root must be an object');
  }

  // default name se ausente
  const name = typeof doc.name === 'string' ? doc.name : 'unnamed-blueprint';

  const blueprint: Blueprint = {
    scope,
    name,
  };

  const init = normalizeSection(doc.initialize, 'initialize');
  if (init) blueprint.initialize = init;

  const maint = normalizeSection(doc.maintenance, 'maintenance');
  if (maint) blueprint.maintenance = maint;

  const knowledge = normalizeKnowledge(doc.knowledge);
  if (knowledge) blueprint.knowledge = knowledge;

  const postBuild = normalizeSection(doc.postBuild ?? doc['post-build'], 'post-build');
  if (postBuild) blueprint.postBuild = postBuild;

  const clone = normalizeClone(doc.clone);
  if (clone) blueprint.clone = clone;

  if (isObject(doc.env)) {
    blueprint.env = doc.env as Record<string, string>;
  }

  if (Array.isArray(doc.secrets)) {
    blueprint.secrets = doc.secrets.filter((s): s is string => typeof s === 'string');
  }

  return blueprint;
}

/**
 * Parse múltiplos blueprints de um arquivo multi-document YAML.
 */
export function parseBlueprints(yaml: string, scope: Blueprint['scope'] = 'repository'): Blueprint[] {
  const docs = yaml.split(/^---\s*$/m).filter(d => d.trim().length > 0);
  return docs.map((d, i) => {
    try {
      return parseBlueprint(d, scope);
    } catch (err) {
      if (err instanceof BlueprintParseError) {
        throw new BlueprintParseError(
          `document ${i}: ${err.message}`,
          err.path,
          err.line,
        );
      }
      throw err;
    }
  });
}

/**
 * Lê blueprint de arquivo.
 */
export function readBlueprint(path: string, scope: Blueprint['scope'] = 'repository'): Blueprint {
  const content = readFileSync(path, 'utf8');
  const docs = parseBlueprints(content, scope);
  if (docs.length === 0) {
    throw new BlueprintParseError(`no blueprints found in ${path}`);
  }
  if (docs.length > 1) {
    // se múltiplos, retorna o primeiro mas avisa
    return docs[0];
  }
  return docs[0];
}

/**
 * Serializa blueprint para YAML.
 */
export function serializeBlueprint(bp: Blueprint): string {
  // remove scope e name do output YAML (eles são metadados)
  const { scope: _scope, name: _name, ...rest } = bp;
  void _scope; void _name;
  // renomeia postBuild → post-build
  const out: Record<string, unknown> = { ...rest };
  if (bp.postBuild) {
    out['post-build'] = bp.postBuild;
    delete out.postBuild;
  }
  return stringifyYaml(out);
}
