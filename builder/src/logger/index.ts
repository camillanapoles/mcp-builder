/**
 * Logger — wrapper sobre pino com child meta + nível controlável.
 */

import pino from 'pino';
import type { Logger as ILogger, LogLevel } from '../types.js';

export function createLogger(level: LogLevel = 'info'): ILogger {
  const pinoLogger = pino({
    level,
    transport: process.stdout.isTTY
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
  });

  return {
    level,
    debug: (msg, meta) => pinoLogger.debug(meta ?? {}, msg),
    info: (msg, meta) => pinoLogger.info(meta ?? {}, msg),
    warn: (msg, meta) => pinoLogger.warn(meta ?? {}, msg),
    error: (msg, meta) => pinoLogger.error(meta ?? {}, msg),
    child: (meta) => {
      const child = pinoLogger.child(meta);
      return {
        level,
        debug: (msg, m) => child.debug(m ?? {}, msg),
        info: (msg, m) => child.info(m ?? {}, msg),
        warn: (msg, m) => child.warn(m ?? {}, msg),
        error: (msg, m) => child.error(m ?? {}, msg),
        child: () => createLogger(level), // simplificado
      };
    },
  };
}
