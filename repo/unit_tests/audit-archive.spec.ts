/**
 * Unit tests for the audit-archive credential selection logic.
 *
 * The archival job in src/jobs/cleanup.ts uses an elevated
 * audit_maintainer credential when AUDIT_MAINTAINER_USER / _PASSWORD
 * are set, and falls back to the main pool otherwise. These tests
 * exercise the env-var branch in createAuditMaintainerConnection
 * without needing a real database.
 */

// We re-require the module after mutating process.env so the config
// snapshot reflects the env we set.
describe('createAuditMaintainerConnection — env var switch', () => {
  const savedUser = process.env.AUDIT_MAINTAINER_USER;
  const savedPassword = process.env.AUDIT_MAINTAINER_PASSWORD;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.AUDIT_MAINTAINER_USER = savedUser;
    process.env.AUDIT_MAINTAINER_PASSWORD = savedPassword;
  });

  test('returns null when neither env var is set', () => {
    delete process.env.AUDIT_MAINTAINER_USER;
    delete process.env.AUDIT_MAINTAINER_PASSWORD;
    const { createAuditMaintainerConnection } = require('../src/config/database');
    expect(createAuditMaintainerConnection()).toBeNull();
  });

  test('returns null when only user is set', () => {
    process.env.AUDIT_MAINTAINER_USER = 'audit_maintainer';
    delete process.env.AUDIT_MAINTAINER_PASSWORD;
    const { createAuditMaintainerConnection } = require('../src/config/database');
    expect(createAuditMaintainerConnection()).toBeNull();
  });

  test('returns null when only password is set', () => {
    delete process.env.AUDIT_MAINTAINER_USER;
    process.env.AUDIT_MAINTAINER_PASSWORD = 'x';
    const { createAuditMaintainerConnection } = require('../src/config/database');
    expect(createAuditMaintainerConnection()).toBeNull();
  });

  test('returns a Sequelize instance when both env vars are set', () => {
    process.env.AUDIT_MAINTAINER_USER = 'audit_maintainer';
    process.env.AUDIT_MAINTAINER_PASSWORD = 'x';
    const { createAuditMaintainerConnection } = require('../src/config/database');
    const instance = createAuditMaintainerConnection();
    expect(instance).not.toBeNull();
    // The mocked Sequelize constructor returns an object with an
    // authenticate() mock function — good enough for the branch test.
    expect(typeof instance.authenticate).toBe('function');
  });
});
