export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const ErrorCodes = {
  VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR' },
  UNAUTHORIZED: { statusCode: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { statusCode: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND' },
  CONFLICT: { statusCode: 409, code: 'CONFLICT' },
  IDEMPOTENCY_CONFLICT: { statusCode: 409, code: 'IDEMPOTENCY_CONFLICT' },
  INTERNAL_ERROR: { statusCode: 500, code: 'INTERNAL_ERROR' },
} as const;
