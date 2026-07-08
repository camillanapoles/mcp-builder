/**
 * ADVISOR hooks — guardião de "qualidade ouro". Pós-execução.
 *
 * Padrão PDCA: Act.
 *
 * Advisors built-in:
 *   - check_coverage       → cobertura de testes ≥ 80%
 *   - check_mutation       → mutation score ≥ 70%
 *   - check_compliance     → sem TODO/FIXME, ADRs presentes, CHANGELOG atualizado
 *   - check_contracts      → contract tests passaram
 *   - sign_off             → release gate final
 *
 * Quando bloqueia, retorna { ok: false, block } com sugestões acionáveis.
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Hook, HookResult } from '../types.js';

const COVERAGE_THRESHOLD = 0.8;
const MUTATION_THRESHOLD = 0.7;

export const checkCoverage: Hook<{ coverage: number; reportPath?: string }> =
  async (_ctx, payload) => {
    if (payload.coverage < COVERAGE_THRESHOLD) {
      return block(
        `coverage ${payload.coverage.toFixed(2)} < ${COVERAGE_THRESHOLD}`,
        [
          `add tests to reach ${COVERAGE_THRESHOLD * 100}% coverage`,
          payload.reportPath ? `see report: ${payload.reportPath}` : '',
        ].filter(Boolean),
      );
    }
    return { ok: true, metrics: { coverage: payload.coverage } };
  };

export const checkMutation: Hook<{ mutationScore: number; reportPath?: string }> =
  async (_ctx, payload) => {
    if (payload.mutationScore < MUTATION_THRESHOLD) {
      return block(
        `mutation score ${payload.mutationScore.toFixed(2)} < ${MUTATION_THRESHOLD}`,
        [
          `strengthen tests — mutants are surviving`,
          payload.reportPath ? `see report: ${payload.reportPath}` : '',
          'focus on edge cases and boundary conditions',
        ],
      );
    }
    return { ok: true, metrics: { mutation_score: payload.mutationScore } };
  };

/**
 * Compliance checks: TODOs, ADRs, CHANGELOG, license.
 */
export const checkCompliance: Hook<{ projectPath: string }> = async (_ctx, payload) => {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 1. Sem TODO/FIXME no código
  const todoCount = await countPatternInCode(payload.projectPath, /\b(TODO|FIXME|HACK|XXX)\b/);
  if (todoCount > 0) {
    issues.push(`found ${todoCount} TODO/FIXME markers in source`);
    suggestions.push('remove all TODO/FIXME markers before release');
  }

  // 2. CHANGELOG.md existe e não-vazio
  const changelogPath = join(payload.projectPath, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    issues.push('CHANGELOG.md missing');
    suggestions.push('create CHANGELOG.md following conventional-commits format');
  } else {
    const changelog = await readFile(changelogPath, 'utf8');
    if (changelog.trim().length < 50) {
      issues.push('CHANGELOG.md too short');
      suggestions.push('document at least the current version changes');
    }
  }

  // 3. Pelo menos 1 ADR
  const adrDir = join(payload.projectPath, 'docs', 'adr');
  if (!existsSync(adrDir)) {
    issues.push('no ADR directory found');
    suggestions.push('create docs/adr/ with at least one Architectural Decision Record');
  } else {
    const adrs = await readdir(adrDir);
    if (adrs.length === 0) {
      issues.push('no ADRs found');
      suggestions.push('document at least one architectural decision');
    }
  }

  // 4. LICENSE presente
  if (!existsSync(join(payload.projectPath, 'LICENSE'))) {
    issues.push('LICENSE file missing');
    suggestions.push('add LICENSE file (MIT, Apache-2.0, etc)');
  }

  if (issues.length > 0) {
    return block(`${issues.length} compliance issue(s): ${issues.join('; ')}`, suggestions);
  }
  return { ok: true, metrics: { compliance_issues: 0 } };
};

/**
 * Contract test verification — todas as contracts passaram.
 */
export const checkContracts: Hook<{ contractResults: Array<{ name: string; passed: boolean }> }> =
  async (_ctx, payload) => {
    const failed = payload.contractResults.filter(r => !r.passed);
    if (failed.length > 0) {
      return block(
        `${failed.length} contract test(s) failed: ${failed.map(f => f.name).join(', ')}`,
        failed.map(f => `fix contract: ${f.name}`),
      );
    }
    return { ok: true, metrics: { contracts_passed: payload.contractResults.length } };
  };

/**
 * Sign-off final antes de release. Combina todas as checks acima.
 */
export const signOff: Hook<{
  projectPath: string;
  coverage: number;
  mutationScore: number;
  contractsPassed: boolean;
}> = async (ctx, payload) => {
  // delega para os outros advisors
  const cov = await checkCoverage(ctx, { coverage: payload.coverage });
  if (!cov.ok) return cov;

  const mut = await checkMutation(ctx, { mutationScore: payload.mutationScore });
  if (!mut.ok) return mut;

  if (!payload.contractsPassed) {
    return block('contract tests did not pass', ['re-run contract tests and fix failures']);
  }

  const comp = await checkCompliance(ctx, { projectPath: payload.projectPath });
  if (!comp.ok) return comp;

  return { ok: true, metrics: { signed_off: 1 } };
};

/**
 * Coleta falha e abre issue com contexto para debug.
 */
export const collectFailure: Hook<{ error: Error; context: Record<string, unknown> }> =
  async (ctx, payload) => {
    ctx.logger.error('failure collected', {
      error: payload.error.message,
      stack: payload.error.stack,
      context: payload.context,
    });
    // Em produção: octokit.issues.create com body contendo erro + contexto
    return {
      ok: true,
      data: {
        issue_url: `https://github.com/${ctx.git.repo}/issues`,
        issue_title: `[advisor] ${payload.error.message.slice(0, 80)}`,
      },
    };
  };

// ============================================================================
// Helpers
// ============================================================================

function block(reason: string, suggestions: string[]): HookResult {
  return {
    ok: false,
    block: {
      reason,
      suggestions,
      docs: 'docs/BLUEPRINT.md#10-compliance-e-determinismo',
    },
  };
}

async function countPatternInCode(root: string, pattern: RegExp): Promise<number> {
  if (!existsSync(root)) return 0;
  let count = 0;
  const exts = new Set(['.ts', '.py', '.go', '.rs', '.js', '.tsx', '.jsx']);
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '__pycache__' || e.name === 'target' || e.name === 'dist') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (exts.has(e.name.slice(e.name.lastIndexOf('.')))) {
        const content = await readFile(full, 'utf8');
        const matches = content.match(new RegExp(pattern.source, 'g'));
        if (matches) count += matches.length;
      }
    }
  }
  await walk(root);
  return count;
}
