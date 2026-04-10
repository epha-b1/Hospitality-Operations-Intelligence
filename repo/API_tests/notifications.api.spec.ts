import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { describeDb } from './db-guard';

let adminToken: string;
let managerToken: string;
let memberToken: string;
let groupId: string;

describeDb('Slice 7 — Notifications API', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    const a = await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' });
    adminToken = a.body.accessToken;
    // manager1 is hotel staff with notification access. The previous
    // version of these tests used member1, but the role policy now
    // restricts notifications to admin/manager/analyst — members are
    // itinerary-only per the spec.
    const mgr = await request(app).post('/auth/login').send({ username: 'manager1', password: 'Manager1!pass' });
    managerToken = mgr.body.accessToken;
    const m = await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' });
    memberToken = m.body.accessToken;

    const g = await request(app).post('/groups').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Notif Test Group' });
    groupId = g.body.id;
    // Manager joins so the group has a notification consumer with the
    // right user role and group membership.
    await request(app).post('/groups/join').set('Authorization', `Bearer ${managerToken}`).send({ joinCode: g.body.join_code });
  });

  afterAll(async () => { await sequelize.close(); });

  test('GET /notifications — returns cursor-paginated notifications (manager)', async () => {
    const res = await request(app).get(`/notifications?groupId=${groupId}`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1); // member_joined event
  });

  test('GET /notifications — cursor pagination works (manager)', async () => {
    const res1 = await request(app).get(`/notifications?groupId=${groupId}&limit=1`).set('Authorization', `Bearer ${managerToken}`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.length).toBe(1);
    if (res1.body.nextCursor) {
      const res2 = await request(app).get(`/notifications?groupId=${groupId}&after=${res1.body.nextCursor}`).set('Authorization', `Bearer ${managerToken}`);
      expect(res2.status).toBe(200);
    }
  });

  test('PATCH /notifications/:id/read — marks as read (manager)', async () => {
    const list = await request(app).get(`/notifications?groupId=${groupId}&limit=1`).set('Authorization', `Bearer ${managerToken}`);
    const notifId = list.body.data[0].id;
    const res = await request(app).patch(`/notifications/${notifId}/read`).set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });

  test('GET /notifications 400 — missing groupId (manager)', async () => {
    const res = await request(app).get('/notifications').set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(400);
  });

  test('GET /notifications 403 — non-member manager', async () => {
    // Register a fresh hotel_admin-promoted user who is not in the group.
    // For simplicity we register an outsider and use the admin token —
    // admin is a member of every group they create, so we instead test
    // a fresh group the admin did NOT join.
    const otherGroup = await request(app).post('/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Notif outsider check ${Date.now()}` });
    // admin is automatically the owner of the group they created, so
    // querying notifications on it is allowed. To test the
    // non-member 403 path we need another HOTEL_STAFF user who is not
    // a member. manager1 IS NOT a member of `otherGroup`, so this is
    // the correct probe.
    const res = await request(app)
      .get(`/notifications?groupId=${otherGroup.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  // ─── Member role gate (itinerary-only policy) ─────────────────────
  test('GET /notifications 403 — member is itinerary-only', async () => {
    const res = await request(app).get(`/notifications?groupId=${groupId}`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('PATCH /notifications/:id/read 403 — member is itinerary-only', async () => {
    // Even if the member somehow had a notification id, the route gate
    // returns 403 before any service-layer logic runs. Use a synthetic
    // UUID to confirm the gate fires before validation/lookup.
    const res = await request(app)
      .patch('/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });
});
