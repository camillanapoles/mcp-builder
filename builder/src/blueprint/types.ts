/**
 * Blueprint types — adaptado da metodologia Devin (sem usar Devin).
 *
 * Um Blueprint descreve COMO configurar o ambiente de um MCP server:
 * - initialize: instala runtimes e ferramentas (uma vez por build)
 * - maintenance: instala deps do projeto (roda a cada build, surfaced ao agente)
 * - knowledge: referência não-executada (comandos lint/test/build)
 * - post-build: validação cross-repo após setup completo
 * - clone: override de git clone defaults (repo-level only)
 *
 * Diferenças vs Devin:
 * - Não usamos Devin. Rodamos localmente ou em GitHub Actions.
 * - $ENVRC vira $MCP_ENVRC (mesma semântica cross-step env propagation).
 * - Secrets vêm de GitHub Actions secrets ou .env local.
 * - "Snapshot" = GitHub Actions cache + artifact.
 */

// ============================================================================
// Step types
// ============================================================================

export type Step =
  | { name?: string; run: string; env?: Record<string, string> }
  | { name?: string; uses: string; with?: Record<string, unknown>; env?: Record<string, string> };

// ============================================================================
// Knowledge — referência NÃO executada, surfaced ao agente
// ============================================================================

export interface KnowledgeEntry {
  name: string;       // ex: "lint", "test", "build", "deploy"
  contents: string;   // texto livre com comandos
}

// ============================================================================
// Clone — override de git clone defaults (repo-level only)
// ============================================================================

export interface CloneConfig {
  path?: string;                    // destino sob ~/repos/ (default: repo short name)
  ref?: string;                     // branch ou tag (default: branch default)
  depth?: number;                   // 0 = full, N = --depth N (default: 0)
  tags?: boolean;                   // false passa --no-tags (default: true)
  submodules?: boolean | 'recursive'; // default: true
  lfs?: boolean;                    // false seta GIT_LFS_SKIP_SMUDGE=1 (default: true)
}

// ============================================================================
// Blueprint — top-level
// ============================================================================

export type BlueprintScope = 'enterprise' | 'organization' | 'repository';

export interface Blueprint {
  scope: BlueprintScope;
  name: string;                     // identificador do blueprint
  initialize?: Step[] | string;     // runtimes, ferramentas globais
  maintenance?: Step[] | string;    // npm install, pip install, etc.
  knowledge?: KnowledgeEntry[];     // referência para o agente
  postBuild?: Step[] | string;      // org/enterprise only — pós-clonar tudo
  clone?: CloneConfig;              // repo-level only
  env?: Record<string, string>;     // env global do blueprint
  secrets?: string[];               // nomes de secrets esperados
}

// ============================================================================
// Blueprint execution context
// ============================================================================

export interface BlueprintContext {
  scope: BlueprintScope;
  workdir: string;                  // ~ para org, repo root para repo
  envrc: string;                    // path para $MCP_ENVRC
  secrets: Record<string, string>;  // secrets resolvidos
  logger: {
    info: (msg: string, meta?: Record<string, unknown>) => void;
    warn: (msg: string, meta?: Record<string, unknown>) => void;
    error: (msg: string, meta?: Record<string, unknown>) => void;
  };
}

// ============================================================================
// Blueprint execution result
// ============================================================================

export interface StepResult {
  name?: string;
  ok: boolean;
  stdout?: string;
  stderr?: string;
  exitCode: number;
  durationMs: number;
}

export interface BlueprintExecutionResult {
  scope: BlueprintScope;
  steps: StepResult[];
  ok: boolean;
  durationMs: number;
  artifacts?: string[];   // paths para arquivos produzidos
}

// ============================================================================
// Snapshot — resultado de um build (equivalente ao snapshot do Devin)
// ============================================================================

export interface Snapshot {
  id: string;
  blueprintName: string;
  scope: BlueprintScope;
  createdAt: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  steps: StepResult[];
  artifacts: string[];
  gitSha: string;
}
