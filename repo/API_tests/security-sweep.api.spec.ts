/**
 * High-value security regression sweep.
 *
 * Concentrated coverage of the failure modes that would cause an audit
 * fail if reintroduced:
 *
 *   1) 401 — every protected router rejects unauthenticated requests
 *   2) 403 — role gates reject members on admin/manager-only routes
 *   3) Object-level — outsider cannot read another group's resources
 *   4) Export ownership — non-owner cannot download a foreign export
 *
 * The per-route spec files already cover finer details. This sweep is
 * a compact, root-cause-focused regression net so a future refactor
 * that accidentally drops a router-level guard fails fast in CI.
 */

import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { describeDb } from './db-guard';

let adminToken: string;
let memberToken: string;
const RUN = `sec-${Date.now()}`;

describeDb('Security regression sweep', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
    memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;
  });
  afterAll(async () => { await sequelize.close(); });

  // ─── 1) 401 unauthenticated ────────────────────────────────────────
  describe('401 unauthenticated', () => {
    const protectedGets: Array<[string, string]> = [
      ['accounts',      '/accounts/me'],
      ['users',         '/users'],
      ['groups',        '/groups'],
      ['notifications', '/notifications?groupId=00000000-0000-0000-0000-000000000000'],
      ['reports',       '/reports/occupancy?from=2026-06-01&to=2026-06-01'],
      ['import-templ',  '/import/templates/staffing'],
      ['quality',       '/quality/checks'],
      ['audit',         '/audit-logs'],
      ['face',          '/face/enrollments'],
    ];

    test.each(protectedGets)('GET %s without token → 401', async (_label, url) => {
      const res = await request(app).get(url);
      expect(res.status).toBe(401);
    });
  });

  // ─── 2) 403 role gate ──────────────────────────────────────────────
  describe('403 role gate (member rejected on admin/manager surfaces)', () => {
    const memberGets: Array<[string, string]> = [
      ['users',        '/users'],
      ['audit',        '/audit-logs'],
      ['quality',      '/quality/checks'],
      ['reports',      '/reports/occupancy?from=2026-06-01&to=2026-06-01'],
      ['import-templ', '/import/templates/staffing'],
    ];

    test.each(memberGets)('member GET %s → 403', async (_label, url) => {
      const res = await request(app)
        .get(url)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ─── 3) Object-level: outsider cannot read another group ───────────
  test('outsider cannot read a group they did not join', async () => {
    // Admin creates a group
    const g = await request(app).post('/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Sec ObjLevel ${RUN}` });
    expect(g.status).toBe(201);

    // Fresh outsider user
    const outsider = `sec_outsider_${RUN}`;
    await request(app).post('/auth/register').send({ username: outsider, password: 'Outsider1!xx' });
    const outsiderLogin = await request(app).post('/auth/login').send({ username: outsider, password: 'Outsider1!xx' });
    const outsiderToken = outsiderLogin.body.accessToken;

    const res = await request(app)
      .get(`/groups/${g.body.id}`)
      .set('Authorization', `Bearer ${outsiderToken}`);
    expect(res.status).toBe(403);
  });

  // ─── 4) Export ownership ───────────────────────────────────────────
  test('non-owner cannot download a foreign export', async () => {
    // Admin creates a CSV report export
    const exp = await request(app).post('/reports/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'occupancy', from: '2026-06-01', to: '2026-06-02', format: 'csv' });
    expect(exp.status).toBe(200);
    const downloadUrl: string = exp.body.downloadUrl;

    // Member (different user) tries to download → 403
    const dl = await request(app)
      .get(downloadUrl)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(dl.status).toBe(403);
  });

  test('non-owner cannot download a foreign account-data export', async () => {
    // Admin requests account export
    const exp = await request(app).post('/accounts/me/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(exp.status).toBe(200);
    const downloadUrl: string = exp.body.downloadUrl;

    const dl = await request(app)
      .get(downloadUrl)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(dl.status).toBe(403);
  });

  // ─── Bonus: trace ID is always returned (observability pin) ────────
  test('all error responses carry traceId', async () => {
    const res = await request(app).get('/groups/does-not-exist');
    expect(res.body.traceId).toBeDefined();
  });
});
