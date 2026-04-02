import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';

let adminToken: string;
let memberToken: string;
let memberUserId: string;

beforeAll(async () => {
  await sequelize.authenticate();

  // Login as hotel_admin
  const adminRes = await request(app)
    .post('/auth/login')
    .send({ username: 'admin', password: 'Admin1!pass' });
  adminToken = adminRes.body.accessToken;

  // Login as member
  const memberRes = await request(app)
    .post('/auth/login')
    .send({ username: 'member1', password: 'Member1!pass' });
  memberToken = memberRes.body.accessToken;
  memberUserId = memberRes.body.user.id;
});

afterAll(async () => {
  await sequelize.close();
});

describe('Slice 3 — RBAC API', () => {
  describe('GET /users', () => {
    test('200 as hotel_admin — returns user list with pagination', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBeGreaterThanOrEqual(4);
      // password_hash should not be present
      for (const user of res.body.data) {
        expect(user.password_hash).toBeUndefined();
      }
    });

    test('403 as member', async () => {
      const res = await request(app)
        .get('/users')
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    test('401 without token', async () => {
      const res = await request(app).get('/users');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /users/:id', () => {
    test('200 as hotel_admin', async () => {
      const res = await request(app)
        .get(`/users/${memberUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.username).toBe('member1');
      expect(res.body.password_hash).toBeUndefined();
    });

    test('403 as member', async () => {
      const res = await request(app)
        .get(`/users/${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });

    test('404 for non-existent user', async () => {
      const res = await request(app)
        .get('/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /users/:id', () => {
    let targetUserId: string;

    beforeAll(async () => {
      // Register a user to update
      const regRes = await request(app)
        .post('/auth/register')
        .send({ username: `rbactest_${Date.now()}`, password: 'RbacTest1!xx' });
      targetUserId = regRes.body.id;
    });

    test('200 as hotel_admin — update status to suspended', async () => {
      const res = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'suspended' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('suspended');
    });

    test('200 as hotel_admin — update role to analyst', async () => {
      const res = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'active', role: 'analyst' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('analyst');
      expect(res.body.status).toBe('active');
    });

    test('403 as member', async () => {
      const res = await request(app)
        .patch(`/users/${targetUserId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'suspended' });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /users/:id', () => {
    let deleteTargetId: string;

    beforeAll(async () => {
      const regRes = await request(app)
        .post('/auth/register')
        .send({ username: `deltest_${Date.now()}`, password: 'DelTest1!xx' });
      deleteTargetId = regRes.body.id;
    });

    test('204 as hotel_admin — soft deletes user', async () => {
      const res = await request(app)
        .delete(`/users/${deleteTargetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);

      // Verify soft delete
      const getRes = await request(app)
        .get(`/users/${deleteTargetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.status).toBe('deleted');
      expect(getRes.body.deleted_at).not.toBeNull();
    });

    test('403 as member', async () => {
      const res = await request(app)
        .delete(`/users/${memberUserId}`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('Manager role — login has propertyId in token', () => {
    test('manager1 login includes propertyId', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({ username: 'manager1', password: 'Manager1!pass' });
      expect(res.status).toBe(200);
      // Verify the JWT has propertyId by checking the profile
      const profile = await request(app)
        .get('/accounts/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`);
      expect(profile.status).toBe(200);
      expect(profile.body.property_id).toBeDefined();
      expect(profile.body.property_id).not.toBeNull();
    });
  });
});
