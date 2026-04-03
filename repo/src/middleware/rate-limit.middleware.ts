import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest } from './auth.middleware';

// General limiter: 200 req/min per-user (falls back to IP for unauthenticated)
export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || req.ip || 'unknown';
  },
  message: { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
});

// Auth limiter: per-IP brute-force protection
// Default 30/min; production: set RATE_LIMIT_AUTH=10 for stricter limit
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH || '30', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' },
});
