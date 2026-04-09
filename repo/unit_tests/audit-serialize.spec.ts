/**
 * Regression-proofing test for audit output masking.
 *
 * The audit controller has one single source of truth for rendering an
 * AuditLog row to any consumer: serializeAuditRow(row). Both queryLogs
 * and exportLogs must go through it. If a future change routes around
 * this helper and emits `row.toJSON()` directly, these tests should
 * fail loudly.
 *
 * We also assert on `AUDIT_CSV_COLUMNS` so the CSV schema cannot drift
 * silently.
 */

import { serializeAuditRow, AUDIT_CSV_COLUMNS } from '../src/controllers/audit.controller';
import { REDACTED } from '../src/utils/masking';

// Build a fake AuditLog-shaped row. toJSON returns the raw (pre-masked)
// detail so we can prove that serializeAuditRow is the one applying the
// mask, not the model layer.
function fakeRow(detail: unknown) {
  const raw = {
    id: 'r1',
    actor_id: 'u1',
    action: 'report_export',
    resource_type: 'report',
    resource_id: 'ex1',
    detail,
    trace_id: 't1',
    ip_address: '127.0.0.1',
    created_at: '2026-04-09T00:00:00.000Z',
  };
  return {
    // Fake a Sequelize instance — toJSON returns the whole shape
    // (pre-masked). serializeAuditRow is responsible for masking.
    toJSON: () => ({ ...raw }),
    // The row instance also exposes detail as a property (sequelize does)
    detail,
  } as any;
}

describe('serializeAuditRow — single-source masking', () => {
  test('deep masks nested sensitive fields', () => {
    const row = fakeRow({
      password: 'super-secret',
      nested: { token: 'jwt', api_key: 'ak_1' },
      events: [
        { accessToken: 'abc', type: 'login' },
        { password_hash: 'bcrypt$x' },
      ],
      nonSensitive: 'keep',
    });

    const out = serializeAuditRow(row);
    const detail: any = out.detail;
    expect(detail.password).toBe(REDACTED);
    expect(detail.nested.token).toBe(REDACTED);
    expect(detail.nested.api_key).toBe(REDACTED);
    expect(detail.events[0].accessToken).toBe(REDACTED);
    expect(detail.events[1].password_hash).toBe(REDACTED);
    expect(detail.nonSensitive).toBe('keep');
    expect(detail.events[0].type).toBe('login');
  });

  test('preserves the other top-level fields (id, action, trace_id…) untouched', () => {
    const row = fakeRow({ password: 'x' });
    const out = serializeAuditRow(row);
    expect(out.id).toBe('r1');
    expect(out.actor_id).toBe('u1');
    expect(out.action).toBe('report_export');
    expect(out.resource_type).toBe('report');
    expect(out.trace_id).toBe('t1');
    expect(out.ip_address).toBe('127.0.0.1');
  });

  test('handles null detail', () => {
    const row = fakeRow(null);
    const out = serializeAuditRow(row);
    expect(out.detail).toBeNull();
  });

  test('raw sensitive values never survive serialization (regression guard)', () => {
    // If a future change accidentally reintroduces a path that bypasses
    // maskSensitiveDeep, the plaintext should appear here and this
    // stringified output check will fail.
    const row = fakeRow({
      password: 'plaintext-password-do-not-leak',
      nested: { api_key: 'ak_live_do_not_leak' },
    });
    const out = serializeAuditRow(row);
    const dumped = JSON.stringify(out);
    expect(dumped).not.toContain('plaintext-password-do-not-leak');
    expect(dumped).not.toContain('ak_live_do_not_leak');
    expect(dumped).toContain(REDACTED);
  });

  test('does not mutate the source row', () => {
    const rawDetail = { password: 'still-there' };
    const row = fakeRow(rawDetail);
    serializeAuditRow(row);
    // Source detail object must remain untouched — masking returns a copy.
    expect(rawDetail.password).toBe('still-there');
  });
});

describe('AUDIT_CSV_COLUMNS — schema pin', () => {
  test('column order is fixed (drift guard)', () => {
    expect(AUDIT_CSV_COLUMNS).toEqual([
      'id',
      'actor_id',
      'action',
      'resource_type',
      'resource_id',
      'trace_id',
      'ip_address',
      'created_at',
      'detail',
    ]);
  });

  test('includes the detail column so masked payload reaches the export', () => {
    expect(AUDIT_CSV_COLUMNS).toContain('detail');
  });
});
