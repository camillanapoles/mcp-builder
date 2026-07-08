/**
 * Hook customizado: prompt-injection-detector
 * Categoria: gate
 *
 * Detecta padrões suspeitos de prompt injection no input do LLM.
 * Não substitui sandboxing/RLHF, mas adiciona camada de defesa.
 *
 * Payload:
 *   { input: string }
 *
 * Detecta:
 *   - "ignore previous instructions"
 *   - "system:" / "assistant:" em user input
 *   - tentativas de override de role
 *   - marcadores de template {{system.xxx}}
 */

import type { HookDescriptor, HookResult } from '../builder/src/types.js';

const SUSPICIOUS_PATTERNS: Array<{ pattern: RegExp; severity: 'low' | 'medium' | 'high'; reason: string }> = [
  {
    pattern: /ignore\s+(previous|prior|all|above)\s+(instructions?|prompts?|rules?)/i,
    severity: 'high',
    reason: 'classic prompt injection pattern detected',
  },
  {
    pattern: /\b(system|assistant)\s*:/i,
    severity: 'high',
    reason: 'role override attempt detected',
  },
  {
    pattern: /\{\{\s*(system|assistant|config|secret)/i,
    severity: 'high',
    reason: 'template injection attempt ({{system.xxx}})',
  },
  {
    pattern: /\b(you\s+are|pretend\s+you\s+are|act\s+as)\s+(a|an)?\s*(system|admin|root|developer)/i,
    severity: 'medium',
    reason: 'role hijacking attempt detected',
  },
  {
    pattern: /(reveal|show|print|dump|expose)\s+(the\s+)?(system\s+)?prompt/i,
    severity: 'medium',
    reason: 'prompt extraction attempt detected',
  },
  {
    pattern: /\b(DAN|do\s+anything\s+now|jailbreak)\b/i,
    severity: 'high',
    reason: 'known jailbreak keyword detected',
  },
  {
    pattern: /<\/?(system|assistant|instruction|tool|function)>/i,
    severity: 'medium',
    reason: 'XML-style role override detected',
  },
];

export const promptInjectionGate: HookDescriptor = {
  name: 'prompt_injection_detector',
  category: 'gate',
  description: 'Detects common prompt injection patterns in input',
  fn: async (_ctx, payload: { input: string }) => {
    const input = String(payload.input ?? '');

    if (input.length === 0) {
      return { ok: true };
    }

    const matches: Array<{ severity: string; reason: string }> = [];
    for (const { pattern, severity, reason } of SUSPICIOUS_PATTERNS) {
      if (pattern.test(input)) {
        matches.push({ severity, reason });
      }
    }

    if (matches.length === 0) {
      return { ok: true, metrics: { 'prompt_injection.matches': 0 } };
    }

    const high = matches.filter(m => m.severity === 'high');
    const medium = matches.filter(m => m.severity === 'medium');

    // high severity always blocks; medium blocks if $MCP_BUILDER_STRICT_PROMPT_INJECTION=1
    const strict = process.env.MCP_BUILDER_STRICT_PROMPT_INJECTION === '1';
    const blocking = [...high, ...(strict ? medium : [])];

    if (blocking.length > 0) {
      return block(
        `${blocking.length} prompt injection pattern(s) detected (${high.length} high, ${medium.length} medium)`,
        [
          'review input and remove suspicious patterns',
          'if legitimate, set $MCP_BUILDER_STRICT_PROMPT_INJECTION=0 to allow medium-severity matches',
          'consider adding input sanitization layer',
        ],
      );
    }

    return {
      ok: true,
      metrics: {
        'prompt_injection.matches': matches.length,
        'prompt_injection.high': high.length,
        'prompt_injection.medium': medium.length,
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
      docs: 'docs/HOOKS.md#prompt-injection-detector',
    },
  };
}
