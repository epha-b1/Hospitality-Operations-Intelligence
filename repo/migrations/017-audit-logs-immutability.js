'use strict';

/**
 * DB-level immutability for audit_logs.
 *
 * Two MySQL triggers enforce the prompt requirement that audit logs remain
 * immutable for at least one year.
 *
 *   1) audit_logs_block_update — reject ALL updates regardless of row age.
 *      Audit records must never be modified in place.
 *
 *   2) audit_logs_block_delete — reject deletes of rows whose `created_at`
 *      is less than 1 year old. This is the actual retention guarantee:
 *      no credential, ORM path, or raw SQL can remove recent history.
 *      Rows older than 1 year can still be deleted so the archive retention
 *      job in src/jobs/cleanup.ts can move them into audit_logs_archive.
 *
 * Triggers fire regardless of source (ORM, raw SQL, ad-hoc client) so they
 * close the gap left by app-level hooks. For defense-in-depth, production
 * deployments should additionally REVOKE UPDATE, DELETE on audit_logs from
 * the application user — see scripts/audit-immutability.sql.
 *
 * Down-migration removes the triggers for dev/test rollback only.
 */
module.exports = {
  async up(queryInterface) {
    // Idempotent drops so reruns do not clash with an existing trigger.
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS audit_logs_block_update'
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS audit_logs_block_delete'
    );

    await queryInterface.sequelize.query(`
      CREATE TRIGGER audit_logs_block_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      BEGIN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'audit_logs is append-only; UPDATE is prohibited';
      END
    `);

    await queryInterface.sequelize.query(`
      CREATE TRIGGER audit_logs_block_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      BEGIN
        IF OLD.created_at >= (NOW() - INTERVAL 1 YEAR) THEN
          SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'audit_logs is immutable for 1 year; cannot DELETE rows newer than retention cutoff';
        END IF;
      END
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS audit_logs_block_update'
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS audit_logs_block_delete'
    );
  },
};
