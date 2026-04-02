import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { auditMiddleware } from './middleware/audit.middleware';
import { AppError } from './utils/errors';
import { traceStore } from './utils/logger';
import { createCategoryLogger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import accountsRoutes from './routes/accounts.routes';
import usersRoutes from './routes/users.routes';

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

// Swagger UI
const stubSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Hospitality Operations Intelligence API',
    version: '1.0.0',
    description: 'Hospitality Operations Intelligence & Group Itinerary Platform',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(stubSpec));

// API routes
app.use('/auth', authRoutes);
app.use('/accounts', accountsRoutes);
app.use('/users', usersRoutes);

// Static file serving for exports
app.use('/exports', express.static(path.resolve('exports')));

// 404 handler
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, 'NOT_FOUND', 'Resource not found'));
});

// Global error handler
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

  systemLogger.error('unhandled_error', {
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    traceId,
  });
});

export default app;
