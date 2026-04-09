import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { describeDb } from './db-guard';

let adminToken: string;
let memberToken: string;
let checkId: string;

describeDb('Slice 11 — Quality API', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
    memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;
  });
  afterAll(async () => { await sequelize.close(); });

  test('POST /quality/checks 201 — create check config', async () => {
    const res = await request(app).post('/quality/checks').set('Authorization', `Bearer ${adminToken}`)
      .send({ entityType: 'reservations', checkType: 'null_coverage', config: { threshold: 0.05 } });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    checkId = res.body.id;
  });

  test('GET /quality/checks 200 — list checks', async () => {
    const res = await request(app).get('/quality/checks').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('POST /quality/checks/:id/run 200 — run check', async () => {
    const res = await request(app).post(`/quality/checks/${checkId}/run`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBeDefined();
    expect(res.body.result).toBeDefined();
  });

  test('GET /quality/results 200', async () => {
    const res = await request(app).get('/quality/results').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  test('POST /quality/checks 403 — member blocked', async () => {
    const res = await request(app).post('/quality/checks').set('Authorization', `Bearer ${memberToken}`)
      .send({ entityType: 'users', checkType: 'null_coverage', config: {} });
    expect(res.status).toBe(403);
  });
});
