import request from 'supertest';
import app from '../src/app';
import { sequelize } from '../src/config/database';

let adminToken: string;
let memberToken: string;
let groupId: string;
let fileId: string;

beforeAll(async () => {
  await sequelize.authenticate();
  const a = await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' });
  adminToken = a.body.accessToken;
  const m = await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' });
  memberToken = m.body.accessToken;

  const g = await request(app).post('/groups').set('Authorization', `Bearer ${adminToken}`).send({ name: 'File Test Group' });
  groupId = g.body.id;
  await request(app).post('/groups/join').set('Authorization', `Bearer ${memberToken}`).send({ joinCode: g.body.join_code });
});

afterAll(async () => { await sequelize.close(); });

describe('Slice 6 — Files API', () => {
  test('POST upload 201 — valid file', async () => {
    const res = await request(app).post(`/groups/${groupId}/files`).set('Authorization', `Bearer ${memberToken}`)
      .attach('file', Buffer.from('hello world'), { filename: 'test.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.original_name).toBe('test.pdf');
    fileId = res.body.id;
  });

  test('POST upload 201 — dedup returns existing', async () => {
    const res = await request(app).post(`/groups/${groupId}/files`).set('Authorization', `Bearer ${memberToken}`)
      .attach('file', Buffer.from('hello world'), { filename: 'test2.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(fileId);
  });

  test('POST upload 400 — disallowed MIME', async () => {
    const res = await request(app).post(`/groups/${groupId}/files`).set('Authorization', `Bearer ${memberToken}`)
      .attach('file', Buffer.from('#!/bin/sh'), { filename: 'script.sh', contentType: 'application/x-sh' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MIME_NOT_ALLOWED');
  });

  test('GET list files 200', async () => {
    const res = await request(app).get(`/groups/${groupId}/files`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  test('DELETE file 403 — member cannot delete', async () => {
    const res = await request(app).delete(`/groups/${groupId}/files/${fileId}`).set('Authorization', `Bearer ${memberToken}`);
    expect(res.status).toBe(403);
  });

  test('DELETE file 204 — owner can delete', async () => {
    const res = await request(app).delete(`/groups/${groupId}/files/${fileId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(204);
  });
});
