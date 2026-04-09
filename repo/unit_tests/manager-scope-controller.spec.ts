/**
 * Unit tests for the manager scope enforcement in the import controller.
 *
 * Complements manager-isolation.spec.ts (service layer) with the
 * controller-layer gate: a manager requesting another property's data
 * gets a 403 AppError, and a manager with no propertyId gets a 403.
 *
 * The controller path:
 *   evaluationReport(req) → enforceManagerScope(req) → service call
 * enforceManagerScope is file-private so we exercise it through the
 * exported controller function by passing fake request objects.
 */

import { AppError } from '../src/utils/errors';
import { evaluationReport, staffingReport } from '../src/controllers/import.controller';
import { sequelize } from '../src/config/database';

// Helper to build a fake express request/response pair + capture next()
function makeReqRes(user: any, query: any = {}) {
  const req: any = { user, query };
  const res: any = {
    body: undefined,
    json(payload: unknown) { this.body = payload; },
  };
  let caught: unknown = null;
  const next = (err?: unknown) => { if (err) caught = err; };
  return { req, res, next, getError: () => caught };
}

describe('import controller — manager scope enforcement', () => {
  beforeEach(() => {
    (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
  });

  describe('evaluationReport', () => {
    test('manager accessing another property → 403 FORBIDDEN', async () => {
      const { req, res, next, getError } = makeReqRes(
        { id: 'u1', role: 'manager', propertyId: 'prop-A' },
        { propertyId: 'prop-B' }
      );
      await evaluationReport(req, res, next);
      const err = getError() as AppError;
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
      // Service should NOT have been called — denial happens at the controller.
      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('manager without propertyId → 403 FORBIDDEN', async () => {
      const { req, res, next, getError } = makeReqRes(
        { id: 'u1', role: 'manager' },
        {}
      );
      await evaluationReport(req, res, next);
      const err = getError() as AppError;
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('manager accessing own property → service called with own propertyId', async () => {
      const { req, res, next } = makeReqRes(
        { id: 'u1', role: 'manager', propertyId: 'prop-A' },
        {}
      );
      await evaluationReport(req, res, next);
      expect(sequelize.query).toHaveBeenCalledTimes(1);
      const [, opts] = (sequelize.query as jest.Mock).mock.calls[0];
      expect(opts.replacements).toContain('prop-A');
    });

    test('admin without propertyId → unscoped (no EXISTS clause)', async () => {
      const { req, res, next } = makeReqRes(
        { id: 'u1', role: 'hotel_admin' },
        {}
      );
      await evaluationReport(req, res, next);
      const [sql] = (sequelize.query as jest.Mock).mock.calls[0];
      expect(sql).not.toMatch(/EXISTS/);
    });

    test('admin with explicit propertyId → service scoped to that property', async () => {
      const { req, res, next } = makeReqRes(
        { id: 'u1', role: 'hotel_admin' },
        { propertyId: 'prop-B' }
      );
      await evaluationReport(req, res, next);
      const [, opts] = (sequelize.query as jest.Mock).mock.calls[0];
      expect(opts.replacements).toContain('prop-B');
    });
  });

  describe('staffingReport — parity check', () => {
    test('manager accessing another property → 403', async () => {
      const { req, res, next, getError } = makeReqRes(
        { id: 'u1', role: 'manager', propertyId: 'prop-A' },
        { propertyId: 'prop-B' }
      );
      await staffingReport(req, res, next);
      const err = getError() as AppError;
      expect(err.statusCode).toBe(403);
      expect(sequelize.query).not.toHaveBeenCalled();
    });

    test('manager → scoped to own property', async () => {
      const { req, res, next } = makeReqRes(
        { id: 'u1', role: 'manager', propertyId: 'prop-A' },
        {}
      );
      await staffingReport(req, res, next);
      const [, opts] = (sequelize.query as jest.Mock).mock.calls[0];
      expect(opts.replacements).toContain('prop-A');
    });
  });
});
