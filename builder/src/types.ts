/**
 * MCP Builder — Tipos compartilhados
 *
 * Estes tipos formam o contrato estável entre:
 * - CLI / MCP server / HTTP API / GitHub Action (4 modos de invocação)
 * - Scaffolder (gerador de projetos)
 * - Hooks system (gate / trigger / event / monitor / advisor)
 * - FSM (máquina de estados GitOps)
 *
 * Mudanças aqui exigem bump de versão major.
 */

// ============================================================================
// Spec — entrada para gerar um MCP server
// ============================================================================

export type SDK = 'python' | 'typescript' | 'go' | 'rust';
export type Pattern = 'event' | 'factory' | 'stateless';

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  outputSchema?: Record<string, unknown>;
}

export interface MCPSpec {
  name: string;
  description: string;
  sdk: SDK;
  pattern: Pattern;
  tools: ToolSpec[];
  hooks?: {
    gate?: string[];
    trigger?: string[];
    event?: string[];
    monitor?: string[];
    advisor?: string[];
  };
  metadata?: {
    author?: string;
    license?: string;
    repository?: string;
    keywords?: string[];
  };
}

// ============================================================================
// FSM — Máquina de Estados GitOps
// ============================================================================

export interface FSMState {
  name: string;
  description: string;
  on_enter?: string[];
  terminal?: boolean;
}

export interface FSMTransition {
  from: string;            // pode ser "*" (curinga)
  to: string;
  event: string;           // pode ser "*.failed"
  action_workflow: string;
  advisor_required?: boolean;
}

export interface FSMDefinition {
  states: Record<string, FSMState>;
  transitions: FSMTransition[];
}

export interface FSMContext {
  current: string;
  history: string[];
  artifacts: Artifact[];
  startedAt: string;
  updatedAt: string;
}

// ============================================================================
// Artifact — payload entre estados (GitHub Actions artifacts)
// ============================================================================

export interface Artifact {
  id: string;
  name: string;
  type: 'json' | 'yaml' | 'binary' | 'text';
  path: string;
  size: number;
  sha: string;
  workflow: string;
  runId: number;
  createdAt: string;
}

// ============================================================================
// Hooks — ponte agentic ↔ determinístico
// ============================================================================

export interface HookContext {
  spec: MCPSpec;
  state: FSMContext;
  artifacts: Artifact[];
  env: Record<string, string>;
  git: { ref: string; sha: string; repo: string };
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

export interface HookBlock {
  reason: string;
  suggestions: string[];
  docs?: string;
}

export interface HookResult {
  ok: boolean;
  block?: HookBlock;
  metrics?: Record<string, number>;
  artifacts?: Artifact[];
  data?: unknown;
}

export type HookCategory = 'gate' | 'trigger' | 'event' | 'monitor' | 'advisor';
export type Hook<T = unknown> = (ctx: HookContext, payload: T) => Promise<HookResult>;

export interface HookDescriptor {
  name: string;
  category: HookCategory;
  description: string;
  fn: Hook;
}

// ============================================================================
// Scaffolder — geração de projeto
// ============================================================================

export interface ScaffolderResult {
  ok: boolean;
  projectPath: string;
  files: string[];
  artifacts?: Artifact[];
  error?: string;
}

// ============================================================================
// Builder — 4 modos de invocação
// ============================================================================

export type InvocationMode = 'cli' | 'mcp' | 'http' | 'action';

export interface BuilderOptions {
  mode: InvocationMode;
  cwd: string;
  verbose: boolean;
  skipHooks?: HookCategory[];
}

// ============================================================================
// Logger
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  level: LogLevel;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  child: (meta: Record<string, unknown>) => Logger;
}
