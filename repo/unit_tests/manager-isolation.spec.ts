/**
 * Unit tests for manager property isolation in the evaluation report path.
 *
 * These tests directly spy on `sequelize.query` and verify two properties:
 *
 *   1) When a propertyId IS supplied, the generated SQL contains the
 *      EXISTS(...staffing_records...) filter and the propertyId is in
 *      the replacement list. An attacker who removes the filter at the
 *      service level would cause the first assertion to fail.
 *
 *   2) When NO propertyId is supplied (admin path), the generated SQL
 *      does NOT contain the filter. This asserts the scope is actually
 *      per-call and not accidentally hard-coded.
 *
 * Both assertions are structural — they would fail if a future refactor
 * silently drops the filter, which is exactly the regression class the
 * static audit flagged.
 */

import { sequelize } from '../src/config/database';
import { evaluationReport, staffingReport } from '../src/services/import.service';

describe('evaluationReport — manager property isolation (SQL-level)', () => {
  beforeEach(() => {
    (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
  });

  test('applies EXISTS filter when propertyId is provided', async () => {
    await evaluationReport({ propertyId: 'prop-A', from: '2025-01-01', to: '2025-12-31' });

    expect(sequelize.query).toHaveBeenCalledTimes(1);
    const [sql, opts] = (sequelize.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM staffing_records s WHERE s\.employee_id = e\.employee_id AND s\.property_id = \?\)/);
    expect(opts.replacements).toContain('prop-A');
  });

  test('does NOT apply EXISTS filter when propertyId is absent (admin path)', async () => {
    await evaluationReport({ from: '2025-01-01', to: '2025-12-31' });

    const [sql, opts] = (sequelize.query as jest.Mock).mock.calls[0];
    expect(sql).not.toMatch(/EXISTS/);
    expect(opts.replacements).not.toContain('prop-A');
  });

  test('date filters are preserved alongside property scope', async () => {
    await evaluationReport({ propertyId: 'prop-X', from: '2025-06-01', to: '2025-06-30' });
    const [sql, opts] = (sequelize.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/e\.effective_date >= \?/);
    expect(sql).toMatch(/e\.effective_date <= \?/);
    // replacements must be in positional order: propertyId, from, to
    expect(opts.replacements).toEqual(['prop-X', '2025-06-01', '2025-06-30']);
  });

  test('property scope is distinct per call — no cross-contamination', async () => {
    await evaluationReport({ propertyId: 'prop-A' });
    await evaluationReport({ propertyId: 'prop-B' });
    await evaluationReport({});

    const calls = (sequelize.query as jest.Mock).mock.calls;
    expect(calls).toHaveLength(3);

    // Call 1 has prop-A
    expect(calls[0][1].replacements).toContain('prop-A');
    expect(calls[0][1].replacements).not.toContain('prop-B');

    // Call 2 has prop-B (not prop-A — proves no state carries over)
    expect(calls[1][1].replacements).toContain('prop-B');
    expect(calls[1][1].replacements).not.toContain('prop-A');

    // Call 3 has neither (admin path)
    expect(calls[2][1].replacements).not.toContain('prop-A');
    expect(calls[2][1].replacements).not.toContain('prop-B');
    expect(calls[2][0]).not.toMatch(/EXISTS/);
  });
});

describe('staffingReport — regression guard for property filter', () => {
  beforeEach(() => {
    (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
  });

  test('property filter is in the WHERE clause when propertyId is provided', async () => {
    await staffingReport({ propertyId: 'prop-Z' });
    const [sql, opts] = (sequelize.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/s\.property_id = \?/);
    expect(opts.replacements).toContain('prop-Z');
  });

  test('no property filter when propertyId absent', async () => {
    await staffingReport({});
    const [sql, opts] = (sequelize.query as jest.Mock).mock.calls[0];
    expect(sql).not.toMatch(/s\.property_id = \?/);
  });
});
