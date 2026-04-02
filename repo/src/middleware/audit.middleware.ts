import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { traceStore } from '../utils/logger';
import { createCategoryLogger } from '../utils/logger';

const systemLogger = createCategoryLogger('system');

export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const traceId = uuidv4();

  res.setHeader('X-Trace-Id', traceId);

  traceStore.run({ traceId }, () => {
    const startTime = Date.now();

    systemLogger.info('request_start', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      systemLogger.info('request_end', {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
      });
    });

    next();
  });
}
