/**
 * App-level immutability guarantees for AuditLog.
 *
 * These assertions cover layer 1 of the enforcement stack (Sequelize
 * hooks). They do not require a real MySQL connection — the mocked
 * sequelize runtime is enough to verify that the hooks reject every
 * mutation path before any SQL is emitted.
 *
 * Layer 2 (DB triggers) and layer 3 (production role grants) are covered
 * in docs/audit-immutability.md with concrete verification commands.
 */

import { AuditLog } from '../src/models/audit.model';

describe('AuditLog — app-level immutability (layer 1)', () => {
  // Helper to fetch a named hook's registered listeners. Sequelize stores
  // hooks in `options.hooks` on the class. We read them defensively so the
  // test works across minor sequelize versions.
  const getHooks = (name: string): Function[] => {
    const cls = AuditLog as unknown as { options?: { hooks?: Record<string, Function[]> } };
    return cls.options?.hooks?.[name] ?? [];
  };

  const callAllHooks = (name: string, arg?: unknown) => {
    const hooks = getHooks(name);
    expect(hooks.length).toBeGreaterThan(0);
    for (const h of hooks) h(arg);
  };

  test('beforeUpdate rejects with AUDIT_IMMUTABLE', () => {
    expect(() => callAllHooks('beforeUpdate')).toThrow(/immutable/i);
  });

  test('beforeDestroy rejects with AUDIT_IMMUTABLE', () => {
    expect(() => callAllHooks('beforeDestroy')).toThrow(/immutable/i);
  });

  test('beforeBulkUpdate rejects', () => {
    expect(() => callAllHooks('beforeBulkUpdate')).toThrow(/immutable/i);
  });

  test('beforeBulkDestroy rejects', () => {
    expect(() => callAllHooks('beforeBulkDestroy')).toThrow(/immutable/i);
  });

  test('beforeSave on a non-new instance rejects', () => {
    // beforeSave takes an instance — we fake one where isNewRecord=false
    expect(() => callAllHooks('beforeSave', { isNewRecord: false })).toThrow(/immutable/i);
  });

  test('beforeSave on a new instance allows the save (create path)', () => {
    expect(() => callAllHooks('beforeSave', { isNewRecord: true })).not.toThrow();
  });

  test('the error carries an AUDIT_IMMUTABLE code', () => {
    try {
      callAllHooks('beforeUpdate');
    } catch (err: any) {
      expect(err?.code).toBe('AUDIT_IMMUTABLE');
      expect(err?.statusCode).toBe(500);
    }
  });
});
