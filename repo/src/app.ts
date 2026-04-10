import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { auditMiddleware } from './middleware/audit.middleware';
import { AppError } from './utils/errors';
import { traceStore } from './utils/logger';
import { createCategoryLogger } from './utils/logger';
import { formatErrorLogMeta, formatErrorResponseBody } from './utils/error-sanitization';
import { openApiSpec } from './swagger';
import { generalLimiter, authLimiter } from './middleware/rate-limit.middleware';
import authRoutes from './routes/auth.routes';
import accountsRoutes from './routes/accounts.routes';
import usersRoutes from './routes/users.routes';
import groupsRoutes from './routes/groups.routes';
import itinerariesRoutes from './routes/itineraries.routes';
import filesRoutes from './routes/files.routes';
import notificationsRoutes from './routes/notifications.routes';
import reportsRoutes from './routes/reports.routes';
import importRoutes from './routes/import.routes';
import faceRoutes from './routes/face.routes';
import qualityRoutes from './routes/quality.routes';
import auditRoutes from './routes/audit.routes';

const systemLogger = createCategoryLogger('system');

const app = express();

// Security and compression
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trace ID on every request
app.use(auditMiddleware);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI — interactive API explorer.
//
// Mounted on TWO paths so reviewers and tooling can find it at the
// conventional location regardless of which convention they use:
//
//   /docs       — short, human-friendly canonical path
//   /api/docs   — historical path, kept for backward compatibility
//
// Both surfaces serve the same generated OpenAPI spec from
// `src/swagger.ts`, plus a raw JSON dump at `/docs/openapi.json` and
// `/api/docs/openapi.json` so codegen tools and clients (e.g.
// swagger-codegen, oapi-codegen) can fetch the spec without scraping
// the swagger-ui HTML.
//
// Order matters: the JSON endpoint MUST be registered BEFORE
// `app.use('/docs', ...)` because swagger-ui-express mounts a
// catch-all handler under its prefix that would otherwise return
// HTML for `/docs/openapi.json`.
app.get('/docs/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});
app.get('/api/docs/openapi.json', (_req: Request, res: Response) => {
  res.json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

// Rate limiting — global IP-based safety net. Per-user quotas are applied
// inside each protected router AFTER auth middleware populates req.user
// (see middleware/rate-limit.middleware.ts:userLimiter).
app.use(generalLimiter);

// API routes
app.use('/auth', authRoutes);
app.use('/accounts', accountsRoutes);
app.use('/users', usersRoutes);
app.use('/groups', groupsRoutes);
app.use('/groups/:groupId/itineraries', itinerariesRoutes);
app.use('/groups/:groupId/files', filesRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/reports', reportsRoutes);
app.use('/import', importRoutes);
app.use('/face', faceRoutes);
app.use('/quality', qualityRoutes);
app.use('/audit-logs', auditRoutes);

// Authenticated export download — strict ownership via ExportRecord
// Policy: a valid ExportRecord MUST exist. No record = 404 (deny by default).
import { authMiddleware as exportAuth, AuthenticatedRequest } from './middleware/auth.middleware';
import { ExportRecord } from './models/export.model';
app.get('/exports/:filename', exportAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = path.basename(req.params.filename);

    // Reject any path traversal or internal temp artifacts
    if (filename.startsWith('.')) {
      next(new AppError(404, 'NOT_FOUND', 'Export not found')); return;
    }

    const record = await ExportRecord.findOne({ where: { filename } });

    // No record = deny. Every legitimate export MUST be registered.
    if (!record) {
      next(new AppError(404, 'NOT_FOUND', 'Export not found')); return;
    }

    // Expired
    if (new Date(record.expires_at) < new Date()) {
      next(new AppError(404, 'NOT_FOUND', 'Export has expired')); return;
    }

    // Ownership: only the creating user or hotel_admin
    const authReq = req as AuthenticatedRequest;
    if (record.user_id !== authReq.user!.id && authReq.user!.role !== 'hotel_admin') {
      next(new AppError(403, 'FORBIDDEN', 'You do not have access to this export')); return;
    }

    const filePath = path.resolve('exports', filename);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) { next(new AppError(404, 'NOT_FOUND', 'Export not found or expired')); return; }
    res.download(filePath);
  } catch (e) { next(e); }
});

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
});

// Global error handler.
//
// AppError is the structured error path — pass message + code through.
// Anything else is an unhandled exception. We log it through the
// system logger with the traceId so support can correlate, but in
// production we strip the stack and the raw error message from both
// the log line and the response body. This avoids leaking SQL
// fragments, file paths, secrets that may have ended up inside an
// exception message, or stack traces that disclose internals.
//
// In non-production we keep the full stack so developers can debug.
//
// Audit-log masking is unaffected — masking happens before the logger
// in audit.controller, and the system logger does NOT touch
// audit_logs. The sanitization helpers live in
// src/utils/error-sanitization.ts so the unit tests exercise the
// exact code path used at runtime.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const traceId = traceStore.getStore()?.traceId || 'unknown';

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      traceId,
    });
    return;
  }

  // Re-evaluate isProd PER REQUEST so tests that flip NODE_ENV after
  // module load still see the right behavior. The cost is one cheap
  // string compare per unhandled error, which is negligible.
  const isProd = process.env.NODE_ENV === 'production';

  systemLogger.error('unhandled_error', formatErrorLogMeta(err, isProd, traceId));
  res.status(500).json(formatErrorResponseBody(err, isProd, traceId));
});

export default app;
