import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';

let adminToken: string;
let memberToken: string;
let managerToken: string;

beforeAll(async () => {
  await sequelize.authenticate();
  adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
  memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;
  managerToken = (await request(app).post('/auth/login').send({ username: 'manager1', password: 'Manager1!pass' })).body.accessToken;
});
afterAll(async () => { await sequelize.close(); });

describe('Slice 8 — Reports API', () => {
  test('GET /reports/occupancy 200 as admin', async () => {
    const res = await request(app).get('/reports/occupancy?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/adr 200 as admin', async () => {
    const res = await request(app).get('/reports/adr?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/revpar 200 as admin', async () => {
    const res = await request(app).get('/reports/revpar?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/revenue-mix 200 as admin', async () => {
    const res = await request(app).get('/reports/revenue-mix?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/occupancy 200 as manager — scoped to property', async () => {
    const res = await request(app).get('/reports/occupancy?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/occupancy 403 as member', async () => {
    const res = await request(app).get('/reports/occupancy?from=2025-01-01&to=2025-12-31').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('POST /reports/export 200 — csv export', async () => {
    const res = await request(app).post('/reports/export').set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'occupancy', from: '2025-01-01', to: '2025-12-31', format: 'csv' });
    expect(res.status).toBe(200);
    expect(res.body.downloadUrl).toBeDefined();
  });

  test('POST /reports/export 403 — PII without permission', async () => {
    const res = await request(app).post('/reports/export').set('Authorization', `Bearer ${managerToken}`)
      .send({ reportType: 'occupancy', from: '2025-01-01', to: '2025-12-31', format: 'csv', includePii: true });
    expect(res.status).toBe(403);
  });

  test('POST /reports/export 200 — excel export', async () => {
    const res = await request(app).post('/reports/export').set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'occupancy', from: '2025-01-01', to: '2025-12-31', format: 'excel' });
    expect(res.status).toBe(200);
    expect(res.body.format).toBe('xlsx');
    expect(res.body.downloadUrl).toMatch(/\.xlsx$/);
  });

  test('SQL injection attempt on propertyId is safe', async () => {
    const res = await request(app).get("/reports/occupancy?from=2025-01-01&to=2025-12-31&propertyId=' OR 1=1 --")
      .set('Authorization', `Bearer ${adminToken}`);
    // Should not crash — returns 200 with empty results (no matching property)
    expect(res.status).toBe(200);
  });

  test('GET /exports/:filename 401 — unauthenticated export access blocked', async () => {
    const res = await request(app).get('/exports/some-file.csv');
    expect(res.status).toBe(401);
  });

  test('GET /reports/staffing 200', async () => {
    const res = await request(app).get('/reports/staffing').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.positionDistribution).toBeDefined();
  });

  test('GET /reports/evaluations 200', async () => {
    const res = await request(app).get('/reports/evaluations').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.resultsSummary).toBeDefined();
  });

  // --- Fix B: manager property isolation on staffing/evaluation ---
  test('GET /reports/staffing 200 as manager — auto-scoped to own property', async () => {
    const res = await request(app).get('/reports/staffing').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /reports/staffing 403 — manager accessing wrong property', async () => {
    const res = await request(app).get('/reports/staffing?propertyId=22222222-2222-2222-2222-222222222222')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /reports/evaluations 200 as manager — auto-scoped', async () => {
    const res = await request(app).get('/reports/evaluations').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  // --- Fix A: export ownership enforcement ---
  test('GET /exports/:filename 404 — file not in export_records', async () => {
    const res = await request(app).get('/exports/nonexistent-file.csv').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('GET /exports/:filename 404 — internal temp file blocked', async () => {
    const res = await request(app).get('/exports/.import-fake-id.json').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  test('export download — owner can access own export', async () => {
    // Create an export first
    const exportRes = await request(app).post('/reports/export').set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'occupancy', from: '2025-01-01', to: '2025-12-31', format: 'csv' });
    expect(exportRes.status).toBe(200);
    const downloadUrl = exportRes.body.downloadUrl;

    // Owner (admin) can download
    const dlRes = await request(app).get(downloadUrl).set('Authorization', `Bearer ${adminToken}`);
    expect(dlRes.status).toBe(200);
  });

  test('export download — non-owner gets 403', async () => {
    // Create export as admin
    const exportRes = await request(app).post('/reports/export').set('Authorization', `Bearer ${adminToken}`)
      .send({ reportType: 'adr', from: '2025-01-01', to: '2025-12-31', format: 'csv' });
    const downloadUrl = exportRes.body.downloadUrl;

    // Manager (non-owner, non-admin) tries to download
    const dlRes = await request(app).get(downloadUrl).set('Authorization', `Bearer ${managerToken}`);
    expect(dlRes.status).toBe(403);
  });
});
