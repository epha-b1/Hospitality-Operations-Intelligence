import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';

let adminToken: string;
let memberToken: string;

beforeAll(async () => {
  await sequelize.authenticate();
  adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
  memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;
});
afterAll(async () => { await sequelize.close(); });

describe('Slice 12 — Audit API', () => {
  test('GET /audit-logs 200 as admin', async () => {
    const res = await request(app).get('/audit-logs').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });

  test('GET /audit-logs 403 as member', async () => {
    const res = await request(app).get('/audit-logs').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /audit-logs/export 200 — CSV export', async () => {
    const res = await request(app).get('/audit-logs/export').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  test('GET /audit-logs/export 403 as member', async () => {
    const res = await request(app).get('/audit-logs/export').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
