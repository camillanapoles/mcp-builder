/**
 * Validator — unit tests
 */

import { describe, it, expect } from 'vitest';
import { validateMCPSpec, validateToolSpec } from '../src/validator/index.js';
import type { MCPSpec, ToolSpec } from '../src/types.js';

const validTool: ToolSpec = {
  name: 'create_user',
  description: 'Creates a new user in the system',
  inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
};

const validSpec: MCPSpec = {
  name: 'my-mcp',
  description: 'A test MCP server for validation',
  sdk: 'python',
  pattern: 'stateless',
  tools: [validTool],
};

describe('validateMCPSpec', () => {
  it('accepts valid spec', () => {
    const r = validateMCPSpec(validSpec);
    expect(r.ok).toBe(true);
    expect(r.block).toBeUndefined();
  });

  it('rejects spec missing required fields', () => {
    const r = validateMCPSpec({ name: 'x' });
    expect(r.ok).toBe(false);
    expect(r.block).toBeDefined();
    expect(r.block?.reason).toContain('failed validation');
  });

  it('rejects invalid name (uppercase)', () => {
    const r = validateMCPSpec({ ...validSpec, name: 'MyMcp' });
    expect(r.ok).toBe(false);
  });

  it('rejects invalid name (starts with number)', () => {
    const r = validateMCPSpec({ ...validSpec, name: '1mcp' });
    expect(r.ok).toBe(false);
  });

  it('rejects invalid sdk', () => {
    const r = validateMCPSpec({ ...validSpec, sdk: 'ruby' as never });
    expect(r.ok).toBe(false);
  });

  it('rejects invalid pattern', () => {
    const r = validateMCPSpec({ ...validSpec, pattern: 'singleton' as never });
    expect(r.ok).toBe(false);
  });

  it('rejects empty tools array', () => {
    const r = validateMCPSpec({ ...validSpec, tools: [] });
    expect(r.ok).toBe(false);
  });

  it('rejects duplicate tool names', () => {
    const r = validateMCPSpec({
      ...validSpec,
      tools: [validTool, { ...validTool }],
    });
    expect(r.ok).toBe(false);
    expect(r.block?.reason).toContain('duplicate');
  });

  it('returns suggestions for fixing', () => {
    const r = validateMCPSpec({ name: 'X' });
    expect(r.block?.suggestions).toBeDefined();
    expect(r.block?.suggestions?.length).toBeGreaterThan(0);
  });

  it('rejects description too short', () => {
    const r = validateMCPSpec({ ...validSpec, description: 'short' });
    expect(r.ok).toBe(false);
  });
});

describe('validateToolSpec', () => {
  it('accepts valid tool', () => {
    const r = validateToolSpec(validTool);
    expect(r.ok).toBe(true);
  });

  it('rejects tool without inputSchema', () => {
    const r = validateToolSpec({ name: 'x', description: 'test tool' } as never);
    expect(r.ok).toBe(false);
  });

  it('rejects tool with invalid name (hyphen)', () => {
    const r = validateToolSpec({ ...validTool, name: 'tool-name' });
    expect(r.ok).toBe(false);
  });

  it('rejects tool with name starting with number', () => {
    const r = validateToolSpec({ ...validTool, name: '1tool' });
    expect(r.ok).toBe(false);
  });

  it('rejects tool with description too short', () => {
    const r = validateToolSpec({ ...validTool, description: 'short' });
    expect(r.ok).toBe(false);
  });
});
