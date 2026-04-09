import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app';
import { sequelize } from '../src/config/database';
import { AuditLog } from '../src/models/audit.model';
import { describeDb } from './db-guard';

let adminToken: string;
let memberToken: string;
let seededId: string;

// A random tag we embed in the seeded audit record's action field so
// we can locate exactly that record in query results without relying
// on insertion order. Every test run uses a fresh tag.
const RUN_TAG = `masking-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

describeDb('Slice 12 — Audit API', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    adminToken = (await request(app).post('/auth/login').send({ username: 'admin', password: 'Admin1!pass' })).body.accessToken;
    memberToken = (await request(app).post('/auth/login').send({ username: 'member1', password: 'Member1!pass' })).body.accessToken;

    // Seed an audit record whose `detail` contains sensitive fields in
    // nested structures (objects and arrays). Masking must strip ALL of
    // these from both the JSON query endpoint and the CSV export.
    seededId = uuidv4();
    await AuditLog.create({
      id: seededId,
      actor_id: null,
      action: RUN_TAG,
      resource_type: 'test',
      resource_id: 'test-1',
      detail: {
        password: 'super-secret-password',
        nested: {
          token: 'jwt-xyz',
          api_key: 'ak_live_123',
        },
        events: [
          { type: 'login', accessToken: 'abc' },
          { type: 'change_password', password_hash: 'bcrypt$...' },
        ],
        nonSensitive: 'keep-me',
      },
      trace_id: 'trace-1',
      ip_address: '127.0.0.1',
      created_at: new Date(),
    });
  });
  afterAll(async () => { await sequelize.close(); });

  // --- Baseline authorization ---------------------------------------------
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

  // --- Redaction in query endpoint ----------------------------------------
  describe('sensitive field masking', () => {
    test('GET /audit-logs masks password/token/secret fields deep in detail', async () => {
      const res = await request(app)
        .get(`/audit-logs?action=${encodeURIComponent(RUN_TAG)}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const row = res.body.data.find((r: any) => r.id === seededId);
      expect(row).toBeDefined();

      // Top-level sensitive key
      expect(row.detail.password).toBe('[REDACTED]');

      // Nested object
      expect(row.detail.nested.token).toBe('[REDACTED]');
      expect(row.detail.nested.api_key).toBe('[REDACTED]');

      // Array elements
      expect(row.detail.events[0].accessToken).toBe('[REDACTED]');
      expect(row.detail.events[1].password_hash).toBe('[REDACTED]');

      // Non-sensitive values are preserved
      expect(row.detail.nonSensitive).toBe('keep-me');
      expect(row.detail.events[0].type).toBe('login');

      // Raw secret values must not appear anywhere in the serialized body
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain('super-secret-password');
      expect(bodyStr).not.toContain('jwt-xyz');
      expect(bodyStr).not.toContain('ak_live_123');
      expect(bodyStr).not.toContain('bcrypt$');
    });

    test('GET /audit-logs/export masks sensitive fields in CSV output', async () => {
      const res = await request(app).get('/audit-logs/export').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');

      const csv = res.text;

      // The seeded row must be present (via its RUN_TAG action).
      expect(csv).toContain(RUN_TAG);

      // Raw secret values must NOT appear anywhere in the CSV.
      expect(csv).not.toContain('super-secret-password');
      expect(csv).not.toContain('jwt-xyz');
      expect(csv).not.toContain('ak_live_123');
      expect(csv).not.toContain('bcrypt$');

      // The [REDACTED] marker must appear (at least once).
      expect(csv).toContain('[REDACTED]');
    });

    test('CSV export is properly quoted (formula injection-safe)', async () => {
      // Insert a row whose action begins with an = character to verify
      // formula neutralization in the export path. action is not
      // considered a sensitive key so it will not be redacted; it must
      // instead be escaped for CSV safety.
      const formulaAction = '=HYPERLINK("http://evil",1)';
      const id = uuidv4();
      await AuditLog.create({
        id,
        actor_id: null,
        action: formulaAction,
        resource_type: 'test',
        resource_id: null,
        detail: null,
        trace_id: null,
        ip_address: null,
        created_at: new Date(),
      });

      const res = await request(app).get('/audit-logs/export').set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // The cell should be wrapped in double quotes and have its leading
      // formula trigger neutralized with a single quote prefix.
      expect(res.text).toContain('"\'=HYPERLINK(""http://evil"",1)"');
    });
  });

  // --- Immutability enforcement -------------------------------------------
  describe('immutability', () => {
    test('AuditLog.update on a seeded row is rejected by the ORM hook', async () => {
      await expect(
        AuditLog.update({ action: 'tampered' }, { where: { id: seededId } })
      ).rejects.toThrow(/immutable/i);
    });

    test('AuditLog.destroy on a seeded row is rejected by the ORM hook', async () => {
      await expect(
        AuditLog.destroy({ where: { id: seededId } })
      ).rejects.toThrow(/immutable/i);
    });

    test('seeded row is still present after rejected mutations', async () => {
      // Confirm the record was neither updated nor deleted — evidence
      // that the hooks prevented the mutation from reaching the DB.
      const row = await AuditLog.findByPk(seededId);
      expect(row).not.toBeNull();
      expect(row!.action).toBe(RUN_TAG);
    });

    test('INSERT (create) is still allowed — audit log remains append-capable', async () => {
      const id = uuidv4();
      const created = await AuditLog.create({
        id,
        actor_id: null,
        action: `${RUN_TAG}-insert`,
        resource_type: 'test',
        resource_id: null,
        detail: null,
        trace_id: null,
        ip_address: null,
        created_at: new Date(),
      });
      expect(created.id).toBe(id);
    });
  });
});
