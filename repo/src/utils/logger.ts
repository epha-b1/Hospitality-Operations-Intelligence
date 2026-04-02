import winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

export const traceStore = new AsyncLocalStorage<{ traceId: string }>();

export type LogCategory = 'auth' | 'rbac' | 'audit' | 'import' | 'reporting' | 'security' | 'system';

function getTraceId(): string | undefined {
  return traceStore.getStore()?.traceId;
}

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, category, ...meta }) => {
      const traceId = getTraceId();
      const entry: Record<string, unknown> = {
        timestamp,
        level,
        message,
        ...(category ? { category } : {}),
        ...(traceId ? { traceId } : {}),
        ...meta,
      };
      return JSON.stringify(entry);
    })
  ),
  transports: [new winston.transports.Console()],
});

export function createCategoryLogger(category: LogCategory) {
  return {
    info: (message: string, meta?: Record<string, unknown>) =>
      logger.info(message, { category, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) =>
      logger.warn(message, { category, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) =>
      logger.error(message, { category, ...meta }),
    debug: (message: string, meta?: Record<string, unknown>) =>
      logger.debug(message, { category, ...meta }),
  };
}
