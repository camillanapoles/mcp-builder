/**
 * Hook customizado: dependency-vulns
 * Categoria: advisor
 *
 * Bloqueia release se vulnerabilidades conhecidas forem encontradas nas deps.
 * Integra com npm audit / pip-audit / cargo audit / govulncheck conforme SDK.
 *
 * Payload:
 *   { sdk: 'python' | 'typescript' | 'go' | 'rust', vulnerabilities: Array<{ name: string; severity: 'low' | 'medium' | 'high' | 'critical'; fixVersion?: string }> }
 *
 * Comportamento:
 *   - critical/high → sempre bloqueia
 *   - medium → bloqueia se $MCP_BUILDER_STRICT_VULNS=1
 *   - low → apenas avisa (não bloqueia)
 */

import type { HookDescriptor, HookResult } from '../builder/src/types.js';

export const dependencyVulnsAdvisor: HookDescriptor = {
  name: 'dependency_vulns',
  category: 'advisor',
  description: 'Block release if known vulnerabilities in dependencies',
  fn: async (_ctx, payload: {
    sdk: 'python' | 'typescript' | 'go' | 'rust';
    vulnerabilities: Array<{
      name: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      fixVersion?: string;
    }>;
  }) => {
    const strict = process.env.MCP_BUILDER_STRICT_VULNS === '1';

    const critical = payload.vulnerabilities.filter(v => v.severity === 'critical');
    const high = payload.vulnerabilities.filter(v => v.severity === 'high');
    const medium = payload.vulnerabilities.filter(v => v.severity === 'medium');
    const low = payload.vulnerabilities.filter(v => v.severity === 'low');

    const blocking = [...critical, ...high, ...(strict ? medium : [])];

    if (blocking.length > 0) {
      const suggestions = blocking.map(v =>
        `upgrade ${v.name} to ${v.fixVersion ?? 'latest'} (${v.severity})`,
      );

      return block(
        `${blocking.length} blocking vulnerabilities found (${critical.length} critical, ${high.length} high${strict ? `, ${medium.length} medium (strict mode)` : ''})`,
        suggestions,
      );
    }

    return {
      ok: true,
      metrics: {
        'vulns.critical': critical.length,
        'vulns.high': high.length,
        'vulns.medium': medium.length,
        'vulns.low': low.length,
        'vulns.blocking': blocking.length,
      },
    };
  },
};

function block(reason: string, suggestions: string[]): HookResult {
  return {
    ok: false,
    block: {
      reason,
      suggestions,
      docs: 'docs/HOOKS.md#dependency-vulns',
    },
  };
}
