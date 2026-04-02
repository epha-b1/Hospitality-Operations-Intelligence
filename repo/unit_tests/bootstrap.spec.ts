import { AppError, ErrorCodes } from '../src/utils/errors';
import { logger, traceStore } from '../src/utils/logger';
import { auditMiddleware } from '../src/middleware/audit.middleware';
import { Request, Response } from 'express';

// Ensure env vars have defaults so config loads in test env
process.env.DB_HOST = process.env.DB_HOST || 'localhost';

describe('Slice 1 — Bootstrap', () => {
  test('environment config loads without throwing', () => {
    expect(() => {
      require('../src/config/environment');
    }).not.toThrow();
  });

  test('AppError sets statusCode and code correctly', () => {
    const err = new AppError(400, 'VALIDATION_ERROR', 'Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Bad input');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  test('ErrorCodes constants have correct values', () => {
    expect(ErrorCodes.UNAUTHORIZED.statusCode).toBe(401);
    expect(ErrorCodes.FORBIDDEN.statusCode).toBe(403);
    expect(ErrorCodes.NOT_FOUND.statusCode).toBe(404);
    expect(ErrorCodes.CONFLICT.statusCode).toBe(409);
    expect(ErrorCodes.INTERNAL_ERROR.statusCode).toBe(500);
  });

  test('logger instance creates without throwing', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  test('audit middleware sets X-Trace-Id header', (done) => {
    const req = {
      method: 'GET',
      path: '/test',
      ip: '127.0.0.1',
    } as Request;

    const headers: Record<string, string> = {};
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
      on: jest.fn(),
      statusCode: 200,
    } as unknown as Response;

    const next = () => {
      expect(headers['X-Trace-Id']).toBeDefined();
      expect(headers['X-Trace-Id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      done();
    };

    auditMiddleware(req, res, next);
  });

  test('traceStore provides traceId inside run callback', (done) => {
    traceStore.run({ traceId: 'test-trace-123' }, () => {
      const store = traceStore.getStore();
      expect(store?.traceId).toBe('test-trace-123');
      done();
    });
  });
});
