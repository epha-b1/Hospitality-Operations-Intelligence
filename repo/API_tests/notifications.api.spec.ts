import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { describeDb } from './db-guard';

let adminToken: string;
let memberToken: string;
let groupId: string;

describeDb('Slice 7 — Notifications API', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const a = await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' });
    adminToken = a.body.accessToken;
    const m = await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' });
    memberToken = m.body.accessToken;

    const g = await request(app).post('/groups').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Notif Test Group' });
    groupId = g.body.id;
    await request(app).post('/groups/join').set('Authorization', `Bearer ${memberToken}`).send({ joinCode: g.body.join_code });
  });

  afterAll(async () => { await sequelize.close(); });

  test('GET /notifications — returns cursor-paginated notifications', async () => {
    const res = await request(app).get(`/notifications?groupId=${groupId}`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1); // member_joined event
  });

  test('GET /notifications — cursor pagination works', async () => {
    const res1 = await request(app).get(`/notifications?groupId=${groupId}&limit=1`).set('Authorization', `Bearer ${memberToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(1);
    if (res1.body.nextCursor) {
      const res2 = await request(app).get(`/notifications?groupId=${groupId}&after=${res1.body.nextCursor}`).set('Authorization', `Bearer ${memberToken}`);
      expect(res2.status).toBe(200);
    }
  });

  test('PATCH /notifications/:id/read — marks as read', async () => {
    const list = await request(app).get(`/notifications?groupId=${groupId}&limit=1`).set('Authorization', `Bearer ${memberToken}`);
    const notifId = list.body.data[0].id;
    const res = await request(app).patch(`/notifications/${notifId}/read`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /notifications 400 — missing groupId', async () => {
    const res = await request(app).get('/notifications').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(400);
  });

  test('GET /notifications 403 — non-member', async () => {
    const reg = await request(app).post('/auth/register').send({ username: `notifout_${Date.now()}`, password: 'NotifOut1!xx' });
    const login = await request(app).post('/auth/login').send({ username: reg.body.username, password: 'NotifOut1!xx' });
    const res = await request(app).get(`/notifications?groupId=${groupId}`).set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
  });
});
