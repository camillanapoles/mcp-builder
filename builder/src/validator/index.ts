/**
 * Validator — valida MCPSpec contra JSON Schema antes de qualquer execução.
 *
 * Usado pelo hook gate. Se falhar, retorna estrutura de block com sugestões
 * que o advisor pode apresentar ao agente/LLM.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { HookResult, MCPSpec, ToolSpec } from '../types.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const toolSpecSchema = {
  type: 'object',
  required: ['name', 'description', 'inputSchema'],
  properties: {
    name: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9_]*$', minLength: 1, maxLength: 64 },
    description: { type: 'string', minLength: 10, maxLength: 500 },
    inputSchema: { type: 'object', required: ['type', 'properties'] },
    outputSchema: { type: 'object' },
  },
};

const mcpSpecSchema = {
  type: 'object',
  required: ['name', 'description', 'sdk', 'pattern', 'tools'],
  properties: {
    name: { type: 'string', pattern: '^[a-z][a-z0-9-]*$', minLength: 2, maxLength: 64 },
    description: { type: 'string', minLength: 10, maxLength: 500 },
    sdk: { enum: ['python', 'typescript', 'go', 'rust'] },
    pattern: { enum: ['event', 'factory', 'stateless'] },
    tools: {
      type: 'array',
      minItems: 1,
      items: toolSpecSchema,
    },
    hooks: { type: 'object' },
    metadata: { type: 'object' },
  },
};

const validateSpec = ajv.compile<MCPSpec>(mcpSpecSchema);
const validateTool = ajv.compile<ToolSpec>(toolSpecSchema);

export interface ValidationResult extends HookResult {
  errors?: Array<{ path: string; message: string }>;
}

export function validateMCPSpec(spec: unknown): ValidationResult {
  if (!validateSpec(spec)) {
    const errors = (validateSpec.errors ?? []).map(e => ({
      path: e.instancePath || '$',
      message: e.message ?? 'invalid',
    }));
    return {
      ok: false,
      errors,
      block: {
        reason: `MCPSpec failed validation: ${errors.length} error(s)`,
        suggestions: errors.map(e => `Fix ${e.path}: ${e.message}`),
        docs: 'docs/BLUEPRINT.md#6-mcp-builder',
      },
    };
  }

  // validação adicional: nomes de tools únicos
  const names = (spec as MCPSpec).tools.map(t => t.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    return {
      ok: false,
      block: {
        reason: `duplicate tool names: ${duplicates.join(', ')}`,
        suggestions: [`rename tools to have unique names`],
      },
    };
  }

  return { ok: true };
}

export function validateToolSpec(tool: unknown): ValidationResult {
  if (!validateTool(tool)) {
    const errors = (validateTool.errors ?? []).map(e => ({
      path: e.instancePath || '$',
      message: e.message ?? 'invalid',
    }));
    return {
      ok: false,
      errors,
      block: {
        reason: `ToolSpec failed validation`,
        suggestions: errors.map(e => `Fix ${e.path}: ${e.message}`),
      },
    };
  }
  return { ok: true };
}

/**
 * Helper para uso direto em hooks gate.
 */
export function asGateResult(spec: unknown): ValidationResult {
  const r = validateMCPSpec(spec);
  if (r.ok) return { ok: true };
  return r;
}
