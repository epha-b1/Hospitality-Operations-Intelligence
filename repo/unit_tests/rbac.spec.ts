import { Request, Response } from 'express';
import { requireRole, requirePropertyScope, AuthenticatedRequest } from '../src/middleware/auth.middleware';

function mockReqRes(user?: AuthenticatedRequest['user']): {
  req: AuthenticatedRequest;
  res: Response;
} {
  const req = { user } as AuthenticatedRequest;
  const res = {} as Response;
  return { req, res };
}

describe('Slice 3 — RBAC Unit Tests', () => {
  describe('requireRole', () => {
    test('allows correct role', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'admin', role: 'hotel_admin' });
      const middleware = requireRole('hotel_admin');
      middleware(req, res, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    test('allows one of multiple accepted roles', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'mgr', role: 'manager' });
      const middleware = requireRole('hotel_admin', 'manager');
      middleware(req, res, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    test('blocks wrong role with 403', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'member1', role: 'member' });
      const middleware = requireRole('hotel_admin');
      middleware(req, res, (err?: unknown) => {
        expect(err).toBeDefined();
        const appErr = err as { statusCode: number; code: string };
        expect(appErr.statusCode).toBe(403);
        expect(appErr.code).toBe('FORBIDDEN');
        done();
      });
    });

    test('returns 401 when no user on request', (done) => {
      const { req, res } = mockReqRes(undefined);
      const middleware = requireRole('hotel_admin');
      middleware(req, res, (err?: unknown) => {
        expect(err).toBeDefined();
        const appErr = err as { statusCode: number; code: string };
        expect(appErr.statusCode).toBe(401);
        done();
      });
    });
  });

  describe('requirePropertyScope', () => {
    test('hotel_admin passes without propertyId', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'admin', role: 'hotel_admin' });
      requirePropertyScope(req, res, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    test('manager with propertyId passes', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'mgr', role: 'manager', propertyId: 'prop-1' });
      requirePropertyScope(req, res, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });

    test('manager without propertyId is blocked with 403', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'mgr', role: 'manager' });
      requirePropertyScope(req, res, (err?: unknown) => {
        expect(err).toBeDefined();
        const appErr = err as { statusCode: number; code: string };
        expect(appErr.statusCode).toBe(403);
        done();
      });
    });

    test('member passes (no property scope needed)', (done) => {
      const { req, res } = mockReqRes({ id: '1', username: 'mem', role: 'member' });
      requirePropertyScope(req, res, (err?: unknown) => {
        expect(err).toBeUndefined();
        done();
      });
    });
  });
});
