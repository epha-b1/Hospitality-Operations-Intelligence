/**
 * Production-safe error sanitization helpers used by the global error
 * handler in src/app.ts.
 *
 * These are extracted into their own module so unit tests can exercise
 * the EXACT functions used at runtime — there is no mirrored copy that
 * could drift from production.
 *
 * Two outputs per unhandled error:
 *   - log meta: structured fields for the system logger
 *   - response body: JSON shape returned to the client
 *
 * In production, neither output carries the raw error message or
 * stack trace. Both still carry traceId + errorClass for correlation.
 * In non-production both outputs carry the full message and stack so
 * developers and tests can debug.
 */

export interface SanitizedLogMeta extends Record<string, unknown> {
  traceId: string;
  errorClass: string;
  error?: string;
  stack?: string;
}

export interface SanitizedResponseBody {
  statusCode: 500;
  code: 'INTERNAL_ERROR';
  message: string;
  traceId: string;
}

export function formatErrorLogMeta(err: Error, isProd: boolean, traceId: string): SanitizedLogMeta {
  const meta: SanitizedLogMeta = {
    traceId,
    errorClass: err.constructor?.name || 'Error',
  };
  if (!isProd) {
    meta.error = err.message;
    meta.stack = err.stack;
  }
  return meta;
}

export function formatErrorResponseBody(err: Error, isProd: boolean, traceId: string): SanitizedResponseBody {
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: isProd ? 'Internal server error' : (err.message || 'Internal server error'),
    traceId,
  };
}

/**
 * Token patterns that should NEVER appear in a production response or
 * log line. Used by the regression unit tests to assert the helpers
 * actually strip them. Adding patterns here is safe — they tighten
 * coverage without affecting runtime.
 */
export const SENSITIVE_TOKEN_PATTERNS = [
  /token=[\w-]+/i,
  /secret=[\w-]+/i,
  /password=[\w-]+/i,
  /Bearer\s+[\w.-]+/i,
  /eyJ[\w.-]+/, // JWT-shaped
] as const;
