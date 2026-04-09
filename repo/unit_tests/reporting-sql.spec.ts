/**
 * Unit tests for the room-night reporting SQL builder.
 *
 * These tests spy on `sequelize.query` and assert structural properties
 * of the generated SQL — they would fail loudly if the room-night
 * fix were ever silently reverted.
 */

import { sequelize } from '../src/config/database';
import { occupancy, adr, revpar } from '../src/services/reporting.service';

describe('reporting service — SQL fragment shape', () => {
  beforeEach(() => {
    (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
  });

  function lastSql(): string {
    return (sequelize.query as jest.Mock).mock.calls[0][0] as string;
  }

  function lastReplacements(): unknown[] {
    return ((sequelize.query as jest.Mock).mock.calls[0][1] as { replacements: unknown[] }).replacements;
  }

  describe('occupancy', () => {
    test('contains recursive calendar CTE', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/WITH RECURSIVE calendar/);
    });

    test('uses check-in inclusive, check-out exclusive', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      const sql = lastSql();
      expect(sql).toMatch(/cal\.night >= res\.check_in_date/);
      expect(sql).toMatch(/cal\.night <\s+res\.check_out_date/);
    });

    test('excludes maintenance rooms from available count', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/rm\.status <> 'maintenance'/);
    });

    test('includes occupancy_rate column in output', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/occupancy_rate/);
    });

    test('NULLIF guards against zero available rooms', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/NULLIF\(SUM\(available_rooms\), 0\)/);
    });

    test('excludes cancelled reservations', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03' });
      const sql = lastSql();
      expect(sql).toMatch(/res\.status IN \('confirmed','checked_in','checked_out'\)/);
      expect(sql).not.toMatch(/'cancelled'/);
    });

    test('manager scope override takes precedence over caller propertyId', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03', propertyId: 'caller-prop' }, 'manager-prop');
      const reps = lastReplacements();
      expect(reps).toContain('manager-prop');
      expect(reps).not.toContain('caller-prop');
    });

    test('room type filter is positional and replicated for both subqueries', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03', roomType: 'suite' });
      const reps = lastReplacements();
      // 'suite' should appear in both available and occupied filters
      const occ = reps.filter(r => r === 'suite').length;
      expect(occ).toBe(2);
    });

    test('day grouping uses YYYY-MM-DD format', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03', groupBy: 'day' });
      expect(lastSql()).toMatch(/DATE_FORMAT\(night, '%Y-%m-%d'\)/);
    });

    test('week grouping uses ISO week format', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03', groupBy: 'week' });
      expect(lastSql()).toMatch(/DATE_FORMAT\(night, '%x-W%v'\)/);
    });

    test('month grouping uses YYYY-MM format', async () => {
      await occupancy({ from: '2026-06-01', to: '2026-06-03', groupBy: 'month' });
      expect(lastSql()).toMatch(/DATE_FORMAT\(night, '%Y-%m'\)/);
    });
  });

  describe('adr', () => {
    test('formula is revenue / occupied (room-nights)', async () => {
      await adr({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/SUM\(revenue_cents\)\s*\/\s*NULLIF\(SUM\(occupied_rooms\), 0\)/);
    });
  });

  describe('revpar', () => {
    test('formula is revenue / available (room-nights)', async () => {
      await revpar({ from: '2026-06-01', to: '2026-06-03' });
      expect(lastSql()).toMatch(/SUM\(revenue_cents\)\s*\/\s*NULLIF\(SUM\(available_rooms\), 0\)/);
    });
  });

  // ─── SQL safety / parameterization ────────────────────────────────
  describe('SQL parameterization', () => {
    test('all dynamic values go through replacements (no string interpolation of user input)', async () => {
      await occupancy({
        from: '2026-06-01',
        to: '2026-06-30',
        propertyId: "p'-or-1=1",
        roomType: "rm'-or-1=1",
      });
      const sql = lastSql();
      const reps = lastReplacements();

      // Dynamic values must NOT appear inline in the SQL string
      expect(sql).not.toContain("p'-or-1=1");
      expect(sql).not.toContain("rm'-or-1=1");

      // They must be in the replacements array
      expect(reps).toContain("p'-or-1=1");
      expect(reps).toContain("rm'-or-1=1");
    });

    test('groupBy enum is whitelisted — never reaches SQL as raw input', async () => {
      // Even with a hostile groupBy value, the SQL only contains one of
      // the three approved DATE_FORMAT expressions. The hostile string
      // is dropped at the periodExpr enum check.
      await occupancy({ from: '2026-06-01', to: '2026-06-30', groupBy: "'; DROP TABLE rooms; --" } as any);
      const sql = lastSql();
      expect(sql).not.toContain('DROP TABLE');
      // Falls back to the default day format
      expect(sql).toMatch(/DATE_FORMAT\(night, '%Y-%m-%d'\)/);
    });
  });

  // ─── Boundary conditions ─────────────────────────────────────────
  describe('boundary conditions', () => {
    test('single-day range — calendar termination guard still produces a row', async () => {
      // The recursive CTE recurses while night < to. For from === to it
      // emits exactly the anchor row and stops, giving a single night.
      await occupancy({ from: '2026-06-01', to: '2026-06-01' });
      const sql = lastSql();
      // The anchor + termination guard pattern is what makes one-day
      // ranges work correctly.
      expect(sql).toMatch(/SELECT DATE\(\?\)/);
      expect(sql).toMatch(/WHERE night < DATE\(\?\)/);
      const reps = lastReplacements();
      // from + to = exactly two parameters (no extra propertyId/roomType)
      expect(reps).toEqual(['2026-06-01', '2026-06-01']);
    });

    test('empty available set — NULLIF guard prevents divide-by-zero in occupancy', async () => {
      // Even when the result set is empty, the SQL generated should
      // still divide via NULLIF(sum, 0) so we get NULL not /0 error.
      (sequelize.query as jest.Mock).mockResolvedValueOnce([]);
      const result = await occupancy({ from: '2026-06-01', to: '2026-06-30' });
      expect(result).toEqual([]);
      // Reconfirm the divide expression is NULLIF-guarded.
      expect(lastSql()).toMatch(/NULLIF\(SUM\(available_rooms\), 0\)/);
    });

    test('empty occupied set — adr/revpar both NULLIF-guarded', async () => {
      (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
      await adr({ from: '2026-06-01', to: '2026-06-30' });
      expect((sequelize.query as jest.Mock).mock.calls[0][0]).toMatch(/NULLIF\(SUM\(occupied_rooms\), 0\)/);

      (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
      await revpar({ from: '2026-06-01', to: '2026-06-30' });
      expect((sequelize.query as jest.Mock).mock.calls[0][0]).toMatch(/NULLIF\(SUM\(available_rooms\), 0\)/);
    });

    test('day/week/month rollups all start from the same per-night CTE', async () => {
      // The CTE definition (`per_night AS …`) must appear before the
      // SELECT in every rollup variant — otherwise different variants
      // could compute from different bases.
      for (const groupBy of ['day', 'week', 'month'] as const) {
        (sequelize.query as jest.Mock).mockReset().mockResolvedValue([]);
        await occupancy({ from: '2026-06-01', to: '2026-06-30', groupBy });
        const sql = (sequelize.query as jest.Mock).mock.calls[0][0] as string;
        expect(sql).toMatch(/per_night AS \(/);
        expect(sql).toMatch(/FROM per_night/);
      }
    });
  });
});
