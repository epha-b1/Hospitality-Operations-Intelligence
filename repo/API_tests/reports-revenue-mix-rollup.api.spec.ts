/**
 * /reports/revenue-mix — period rollup completeness.
 *
 * The audit feedback flagged that occupancy/ADR/RevPAR support
 * day/week/month rollups but `revenue_mix` was category-only. This
 * spec proves the new `period` query parameter:
 *
 *   - period absent           → one row per category (channel),
 *                                aggregate over the full date range
 *                                (historical behavior preserved)
 *   - period=day              → one row per (day × category)
 *   - period=week             → one row per (ISO week × category)
 *   - period=month            → one row per (calendar month × category)
 *   - period + groupBy=room_type
 *                              → category dimension switches to room_type
 *
 * Numbers are exact, computed from a deliberately-seeded fixture so
 * any future drift in the SQL builder triggers a hard failure.
 *
 * Fixture (isolated property):
 *   Property: `rmix-test-<RUN_TAG>`
 *   Rooms:
 *     R_STD_1  standard  available
 *     R_STD_2  standard  available
 *     R_DLX_1  deluxe    available
 *   Date range:  2026-09-01 .. 2026-09-04 inclusive (4 nights)
 *   Reservations (all confirmed → counted):
 *     res_dir  R_STD_1  09-01 → 09-03  rate 100  channel='direct'   → 2 std nights
 *     res_ota  R_STD_2  09-02 → 09-04  rate 150  channel='ota'      → 2 std nights
 *     res_dlx  R_DLX_1  09-01 → 09-04  rate 400  channel='direct'   → 3 dlx nights
 *
 * Expected aggregates (no period):
 *   channel=direct → revenue = 100*2 + 400*3 = 200 + 1200 = 1400
 *                    room_nights = 2 + 3 = 5
 *   channel=ota    → revenue = 150*2 = 300
 *                    room_nights = 2
 *
 * Expected aggregates (no period, groupBy=room_type):
 *   room_type=standard → revenue = 200 + 300 = 500   nights = 4
 *   room_type=deluxe   → revenue = 1200             nights = 3
 *
 * Expected per-day rollup (period=day, default channel):
 *   2026-09-01: direct = (R_STD_1 100 + R_DLX_1 400) = 500   nights=2
 *   2026-09-02: direct = (R_STD_1 100 + R_DLX_1 400) = 500   nights=2
 *               ota    = (R_STD_2 150)              = 150   nights=1
 *   2026-09-03: ota    = (R_STD_2 150)              = 150   nights=1
 *               direct = (R_DLX_1 400)              = 400   nights=1
 *   (no rows after 2026-09-03 because all reservations checked out by 09-04)
 *
 * Expected per-month rollup (period=month):
 *   2026-09: direct = 1400, ota = 300
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { Property, Room, Reservation } from '../src/models/property.model';
import { describeDb } from './db-guard';

const RUN_TAG = `rmix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const PROP_ID = uuidv4();
const FROM = '2026-09-01';
const TO   = '2026-09-04';

let adminToken: string;

describeDb('Reports revenue-mix rollup — GET /reports/revenue-mix', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = (await request(app).post('/auth/login').send({
      username: 'admin', password: 'Admin1!pass',
    })).body.accessToken;

    const now = new Date();
    await Property.create({
      id: PROP_ID, name: `rmix-test-${RUN_TAG}`, address: 'rmix test',
      created_at: now, updated_at: now,
    });

    const rStd1 = uuidv4();
    const rStd2 = uuidv4();
    const rDlx1 = uuidv4();
    await Room.bulkCreate([
      { id: rStd1, property_id: PROP_ID, room_number: '101', room_type: 'standard',
        rate_cents: 10000, status: 'available', created_at: now, updated_at: now } as any,
      { id: rStd2, property_id: PROP_ID, room_number: '102', room_type: 'standard',
        rate_cents: 10000, status: 'available', created_at: now, updated_at: now } as any,
      { id: rDlx1, property_id: PROP_ID, room_number: '201', room_type: 'deluxe',
        rate_cents: 20000, status: 'available', created_at: now, updated_at: now } as any,
    ]);

    await Reservation.bulkCreate([
      { id: uuidv4(), property_id: PROP_ID, room_id: rStd1, guest_name: 'DIR-STD',
        channel: 'direct', check_in_date: '2026-09-01', check_out_date: '2026-09-03',
        rate_cents: 100, status: 'confirmed', created_at: now, updated_at: now } as any,
      { id: uuidv4(), property_id: PROP_ID, room_id: rStd2, guest_name: 'OTA-STD',
        channel: 'ota', check_in_date: '2026-09-02', check_out_date: '2026-09-04',
        rate_cents: 150, status: 'confirmed', created_at: now, updated_at: now } as any,
      { id: uuidv4(), property_id: PROP_ID, room_id: rDlx1, guest_name: 'DIR-DLX',
        channel: 'direct', check_in_date: '2026-09-01', check_out_date: '2026-09-04',
        rate_cents: 400, status: 'confirmed', created_at: now, updated_at: now } as any,
    ]);
  });

  afterAll(async () => {
    try {
      await Reservation.destroy({ where: { property_id: PROP_ID } });
      await Room.destroy({ where: { property_id: PROP_ID } });
      await Property.destroy({ where: { id: PROP_ID } });
    } catch { /* best-effort cleanup */ }
    await sequelize.close();
  });

  // ─── No period: collapsed shape (historical) ─────────────────────

  test('GET /reports/revenue-mix — no period, default channel: one row per channel', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ category: string; total_revenue: number; room_nights: number; period?: string }>;

    // No `period` field on any row — historical collapsed shape
    for (const row of rows) {
      expect(row.period).toBeUndefined();
    }

    // Two categories: direct and ota. Find each by category name.
    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
    expect(byCategory.direct).toBeDefined();
    expect(byCategory.ota).toBeDefined();

    // direct = R_STD_1 (100*2) + R_DLX_1 (400*3) = 200 + 1200 = 1400
    expect(Number(byCategory.direct.total_revenue)).toBe(1400);
    expect(Number(byCategory.direct.room_nights)).toBe(5);

    // ota = R_STD_2 (150*2) = 300
    expect(Number(byCategory.ota.total_revenue)).toBe(300);
    expect(Number(byCategory.ota.room_nights)).toBe(2);
  });

  test('GET /reports/revenue-mix?groupBy=room_type — no period, room_type category', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&groupBy=room_type`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ category: string; total_revenue: number; room_nights: number }>;
    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));

    // standard: R_STD_1 (100*2) + R_STD_2 (150*2) = 500   nights = 4
    expect(Number(byCategory.standard.total_revenue)).toBe(500);
    expect(Number(byCategory.standard.room_nights)).toBe(4);

    // deluxe: R_DLX_1 (400*3) = 1200   nights = 3
    expect(Number(byCategory.deluxe.total_revenue)).toBe(1200);
    expect(Number(byCategory.deluxe.room_nights)).toBe(3);
  });

  // ─── Period rollup ───────────────────────────────────────────────

  test('GET /reports/revenue-mix?period=day — per-day × per-channel rows', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&period=day`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ period: string; category: string; total_revenue: number; room_nights: number }>;

    // Every row carries a `period` field now
    for (const row of rows) {
      expect(row.period).toBeDefined();
      expect(row.period).toMatch(/^2026-09-0\d$/);
    }

    // Build a (period, category) → row index
    const idx: Record<string, { rev: number; nights: number }> = {};
    for (const row of rows) {
      idx[`${row.period}|${row.category}`] = {
        rev: Number(row.total_revenue),
        nights: Number(row.room_nights),
      };
    }

    // 09-01: direct = 100 (R_STD_1) + 400 (R_DLX_1) = 500, nights = 2
    expect(idx['2026-09-01|direct']).toEqual({ rev: 500, nights: 2 });
    expect(idx['2026-09-01|ota']).toBeUndefined();

    // 09-02: direct = 100 + 400 = 500, nights = 2
    //        ota    = 150,             nights = 1
    expect(idx['2026-09-02|direct']).toEqual({ rev: 500, nights: 2 });
    expect(idx['2026-09-02|ota']).toEqual({ rev: 150, nights: 1 });

    // 09-03: direct = 400 (R_DLX_1 only — R_STD_1 checked out 09-03), nights = 1
    //        ota    = 150,                                            nights = 1
    expect(idx['2026-09-03|direct']).toEqual({ rev: 400, nights: 1 });
    expect(idx['2026-09-03|ota']).toEqual({ rev: 150, nights: 1 });

    // 09-04: nothing (all checked out)
    expect(idx['2026-09-04|direct']).toBeUndefined();
    expect(idx['2026-09-04|ota']).toBeUndefined();

    // Cross-check: per-day totals collapse back to the no-period totals
    const directTotalRev = (idx['2026-09-01|direct'].rev) + (idx['2026-09-02|direct'].rev) + (idx['2026-09-03|direct'].rev);
    const otaTotalRev = (idx['2026-09-02|ota'].rev) + (idx['2026-09-03|ota'].rev);
    expect(directTotalRev).toBe(1400);
    expect(otaTotalRev).toBe(300);
  });

  test('GET /reports/revenue-mix?period=month — single month, per-channel rows', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&period=month`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ period: string; category: string; total_revenue: number; room_nights: number }>;
    // All rows fall in 2026-09
    for (const row of rows) expect(row.period).toBe('2026-09');

    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
    expect(Number(byCategory.direct.total_revenue)).toBe(1400);
    expect(Number(byCategory.direct.room_nights)).toBe(5);
    expect(Number(byCategory.ota.total_revenue)).toBe(300);
    expect(Number(byCategory.ota.room_nights)).toBe(2);
  });

  test('GET /reports/revenue-mix?period=week — ISO week format', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&period=week`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ period: string; category: string }>;
    // ISO week format: YYYY-Www
    for (const row of rows) {
      expect(row.period).toMatch(/^\d{4}-W\d{2}$/);
    }
  });

  test('GET /reports/revenue-mix?period=month&groupBy=room_type — both dimensions', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&period=month&groupBy=room_type`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const rows = res.body as Array<{ period: string; category: string; total_revenue: number; room_nights: number }>;

    const byCategory = Object.fromEntries(rows.map((r) => [r.category, r]));
    // standard total in this month: 500, deluxe: 1200
    expect(byCategory.standard.period).toBe('2026-09');
    expect(Number(byCategory.standard.total_revenue)).toBe(500);
    expect(Number(byCategory.standard.room_nights)).toBe(4);
    expect(byCategory.deluxe.period).toBe('2026-09');
    expect(Number(byCategory.deluxe.total_revenue)).toBe(1200);
    expect(Number(byCategory.deluxe.room_nights)).toBe(3);
  });

  // ─── Negative validation ─────────────────────────────────────────

  test('GET /reports/revenue-mix 400 — invalid period', async () => {
    const res = await request(app)
      .get(`/reports/revenue-mix?from=${FROM}&to=${TO}&propertyId=${PROP_ID}&period=year`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
