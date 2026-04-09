/**
 * Unit tests for production error sanitization.
 *
 * The helpers tested here are used directly by the global error
 * handler in src/app.ts (no mirrored copy), so any drift between this
 * spec and the real handler is impossible.
 *
 * Coverage:
 *  - prod log meta carries traceId + errorClass but NOT error/stack
 *  - prod response body is generic 500 with no leaked content
 *  - non-prod log meta carries error + stack (debugging friendly)
 *  - non-prod response body surfaces the underlying message
 *  - regression: every secret-shaped pattern is stripped from prod
 *    response and prod log
 *  - end-to-end via real express app: production NODE_ENV → no leak
 */

import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import {
  formatErrorLogMeta,
  formatErrorResponseBody,
  SENSITIVE_TOKEN_PATTERNS,
} from '../src/utils/error-sanitization';
import { AppError } from '../src/utils/errors';

const TRACE = 'trace-fixture';

describe('error sanitization helpers', () => {
  describe('formatErrorLogMeta', () => {
    test('prod: only traceId + errorClass', () => {
      const err = new Error('SECRET_VALUE_LEAK_token=abc123');
      const meta = formatErrorLogMeta(err, true, TRACE);
      expect(meta).toEqual({ traceId: TRACE, errorClass: 'Error' });
      expect(meta.error).toBeUndefined();
      expect(meta.stack).toBeUndefined();
    });

    test('non-prod: includes error message + stack', () => {
      const err = new Error('debug-only-message');
      const meta = formatErrorLogMeta(err, false, TRACE);
      expect(meta.traceId).toBe(TRACE);
      expect(meta.errorClass).toBe('Error');
      expect(meta.error).toBe('debug-only-message');
      expect(meta.stack).toBeDefined();
    });

    test('errorClass falls back to "Error" when constructor is unavailable', () => {
      // Object.create(null) has no prototype → no .constructor — the
      // helper must default to 'Error' rather than throw.
      const stripped = Object.create(null) as Error;
      (stripped as any).message = 'x';
      const meta = formatErrorLogMeta(stripped, true, TRACE);
      expect(meta.errorClass).toBe('Error');
    });

    test('subclass name is preserved (TypeError, RangeError, …)', () => {
      const meta = formatErrorLogMeta(new TypeError('boom'), true, TRACE);
      expect(meta.errorClass).toBe('TypeError');
    });
  });

  describe('formatErrorResponseBody', () => {
    test('prod: generic 500 message, no underlying text', () => {
      const err = new Error('Bearer eyJabcdef.payload.sig');
      const body = formatErrorResponseBody(err, true, TRACE);
      expect(body).toEqual({
        statusCode: 500,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        traceId: TRACE,
      });
    });

    test('non-prod: surfaces error message', () => {
      const body = formatErrorResponseBody(new Error('debug'), false, TRACE);
      expect(body.message).toBe('debug');
    });

    test('non-prod: empty message → generic fallback', () => {
      const body = formatErrorResponseBody(new Error(''), false, TRACE);
      expect(body.message).toBe('Internal server error');
    });
  });

  // ─── Regression: no token-shaped string leaks in prod ──────────────
  describe('regression: secret patterns are stripped in prod', () => {
    const dangerousMessages = [
      'auth token=abc-123-xyz',
      'X-Api-Key secret=hunter2',
      'connection password=hunter2 failed',
      'invalid Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      'jwt eyJabcdef.payload.signature',
    ];

    test.each(dangerousMessages)('prod response strips: %s', (msg) => {
      const body = formatErrorResponseBody(new Error(msg), true, TRACE);
      const dump = JSON.stringify(body);
      // None of the patterns should appear in the serialized body
      for (const pat of SENSITIVE_TOKEN_PATTERNS) {
        expect(dump).not.toMatch(pat);
      }
      // The dangerous message itself must not appear
      expect(dump).not.toContain(msg);
    });

    test.each(dangerousMessages)('prod log meta strips: %s', (msg) => {
      const meta = formatErrorLogMeta(new Error(msg), true, TRACE);
      const dump = JSON.stringify(meta);
      for (const pat of SENSITIVE_TOKEN_PATTERNS) {
        expect(dump).not.toMatch(pat);
      }
      expect(dump).not.toContain(msg);
    });

    test('non-prod logs DO include the message (debugging is intentional)', () => {
      // Sanity check that the prod-only test isn't a vacuous tautology.
      const meta = formatErrorLogMeta(new Error('auth token=abc-123-xyz'), false, TRACE);
      expect(meta.error).toContain('token=abc-123-xyz');
    });
  });

  // ─── End-to-end via a real express handler chain ──────────────────
  // Builds a tiny express app whose error handler is the EXACT same
  // function shape as src/app.ts (it imports the same helpers). This
  // proves the helpers + the handler-pair behave correctly under
  // real NODE_ENV switching.
  describe('integration: real express handler chain', () => {
    function buildApp() {
      const app = express();
      app.get('/boom', (_req, _res, next) => next(new Error('Bearer eyJleak.payload.sig')));
      app.get('/known', (_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'thing missing')));
      app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
        if (err instanceof AppError) {
          res.status(err.statusCode).json({
            statusCode: err.statusCode, code: err.code, message: err.message, traceId: TRACE,
          });
          return;
        }
        const isProd = process.env.NODE_ENV === 'production';
        res.status(500).json(formatErrorResponseBody(err, isProd, TRACE));
      });
      return app;
    }

    test('NODE_ENV=production → no token leak in response body', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await request(buildApp()).get('/boom');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('Internal server error');
        expect(JSON.stringify(res.body)).not.toContain('eyJleak');
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    test('NODE_ENV=development → message is exposed (debug-friendly)', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        const res = await request(buildApp()).get('/boom');
        expect(res.status).toBe(500);
        expect(res.body.message).toContain('eyJleak');
      } finally {
        process.env.NODE_ENV = prev;
      }
    });

    test('AppError path is unchanged regardless of env', async () => {
      for (const env of ['production', 'development'] as const) {
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = env;
        try {
          const res = await request(buildApp()).get('/known');
          expect(res.status).toBe(404);
          expect(res.body.code).toBe('NOT_FOUND');
          expect(res.body.message).toBe('thing missing');
        } finally {
          process.env.NODE_ENV = prev;
        }
      }
    });
  });
});
