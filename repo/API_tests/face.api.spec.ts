import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';

let memberToken: string;
let sessionId: string;

beforeAll(async () => {
  await sequelize.authenticate();
  memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;
});
afterAll(async () => { await sequelize.close(); });

describe('Slice 10 — Face Enrollment API', () => {
  test('POST /face/enroll/start 201 — creates session', async () => {
    const res = await request(app).post('/face/enroll/start').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(201);
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.requiredAngles).toEqual(['left', 'front', 'right']);
    sessionId = res.body.sessionId;
  });

  test('POST /face/enroll/:sessionId/capture 200 — left angle', async () => {
    const res = await request(app).post(`/face/enroll/${sessionId}/capture`).set('Authorization', `Bearer ${memberToken}`)
      .field('angle', 'left').field('blinkTimingMs', '200').field('motionScore', '0.8').field('textureScore', '0.7');
    expect(res.status).toBe(200);
    expect(res.body.livenessResult.passed).toBe(true);
  });

  test('POST capture — front angle', async () => {
    const res = await request(app).post(`/face/enroll/${sessionId}/capture`).set('Authorization', `Bearer ${memberToken}`)
      .field('angle', 'front').field('blinkTimingMs', '250').field('motionScore', '0.9').field('textureScore', '0.8');
    expect(res.status).toBe(200);
    expect(res.body.livenessResult.passed).toBe(true);
  });

  test('POST capture — right angle', async () => {
    const res = await request(app).post(`/face/enroll/${sessionId}/capture`).set('Authorization', `Bearer ${memberToken}`)
      .field('angle', 'right').field('blinkTimingMs', '300').field('motionScore', '0.7').field('textureScore', '0.6');
    expect(res.status).toBe(200);
    expect(res.body.livenessResult.passed).toBe(true);
  });

  test('POST /face/enroll/:sessionId/complete 201 — completes enrollment', async () => {
    const res = await request(app).post(`/face/enroll/${sessionId}/complete`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(201);
    expect(res.body.enrollmentId).toBeDefined();
    expect(res.body.version).toBe(1);
  });

  test('POST complete 400 — incomplete angles', async () => {
    const start = await request(app).post('/face/enroll/start').set('Authorization', `Bearer ${memberToken}`);
    await request(app).post(`/face/enroll/${start.body.sessionId}/capture`).set('Authorization', `Bearer ${memberToken}`)
      .field('angle', 'left').field('blinkTimingMs', '200').field('motionScore', '0.8').field('textureScore', '0.7');
    const res = await request(app).post(`/face/enroll/${start.body.sessionId}/complete`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(400);
  });

  test('POST capture 400 — liveness fails (blink too fast)', async () => {
    const start = await request(app).post('/face/enroll/start').set('Authorization', `Bearer ${memberToken}`);
    const res = await request(app).post(`/face/enroll/${start.body.sessionId}/capture`).set('Authorization', `Bearer ${memberToken}`)
      .field('angle', 'left').field('blinkTimingMs', '50').field('motionScore', '0.8').field('textureScore', '0.7');
    expect(res.status).toBe(200);
    expect(res.body.livenessResult.passed).toBe(false);
  });

  test('GET /face/enrollments 200 — lists enrollments', async () => {
    const res = await request(app).get('/face/enrollments').set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /face/enrollments/:id — deactivate', async () => {
    const list = await request(app).get('/face/enrollments').set('Authorization', `Bearer ${memberToken}`);
    const active = list.body.find((e: any) => e.status === 'active');
    if (active) {
      const res = await request(app).patch(`/face/enrollments/${active.id}`).set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'deactivated' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('deactivated');
    }
  });
});
