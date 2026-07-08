/**
 * Builder public API — exports estáveis.
 */

export * from './types.js';
export { FSM, FSMError } from './fsm/index.js';
export { Scaffolder } from './scaffolder/index.js';
export { HookRegistry } from './hooks/registry.js';
export { validateMCPSpec, validateToolSpec, asGateResult } from './validator/index.js';
export { createLogger } from './logger/index.js';
export { createCLI } from './cli/index.js';
export { startMCPServer } from './mcp/server.js';
export { startHTTPServer } from './http/server.js';
export { runAction } from './action/index.js';

// Blueprint module — Devin-style declarative environment configuration
export * from './blueprint/index.js';
