'use strict';

/**
 * Scope idempotency_keys uniqueness by resource target as well as
 * (key, actor_id, operation).
 *
 * ── Why ─────────────────────────────────────────────────────────────
 *
 * Migration 016 defined `(key, actor_id, operation)` as UNIQUE. That
 * scope is too coarse for update-type operations: the same actor can
 * legitimately update two different resources ("itinerary-item A" and
 * "itinerary-item B") using the same client-generated key ("retry-1")
 * because idempotency keys are typically per-request, not per-resource.
 *
 * With the old index the second update aborted with a unique-constraint
 * error — or, worse, the service layer's lookup matched the *first*
 * resource's stored row and replayed that stale response against the
 * second call. Either outcome is wrong. The audit classified this as a
 * High-severity cross-resource replay hazard.
 *
 * ── Fix ─────────────────────────────────────────────────────────────
 *
 * 1. Backfill any existing NULL `resource_id` rows to the empty string
 *    so MySQL's "multiple NULLs allowed" behavior in UNIQUE indexes
 *    does not undermine the new scope. The new logical rule is:
 *
 *       `resource_id = ''` means "operation has no resource target"
 *       (e.g. a pure side-effect write that doesn't map to one row);
 *       two such writes with the same (key, actor, op) are still a
 *       legitimate collision and must replay/conflict as before.
 *
 * 2. Alter `resource_id` to NOT NULL DEFAULT '' so the uniqueness
 *    guarantee is total.
 *
 * 3. Drop the legacy `(key, actor_id, operation)` unique index and
 *    replace it with `(key, actor_id, operation, resource_id)`.
 *
 * Idempotent / re-runnable: up() and down() both inspect
 * information_schema before dropping or adding indexes.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    const OLD_INDEX = 'idx_idemp_key_actor_op';
    const NEW_INDEX = 'idx_idemp_key_actor_op_res';

    // 1. Backfill null resource_id rows so the column can be made
    //    non-null. Safe because resource_id was only nullable for rows
    //    that had no concrete target — we map them to '' now.
    await sequelize.query(
      `UPDATE idempotency_keys SET resource_id = '' WHERE resource_id IS NULL`
    );

    // 2. Make resource_id NOT NULL DEFAULT ''. Use changeColumn so
    //    existing defaults / collations are preserved.
    await queryInterface.changeColumn('idempotency_keys', 'resource_id', {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
    });

    // 3. Drop legacy composite and install the resource-aware one.
    const oldExisting = await sequelize.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'idempotency_keys'
          AND INDEX_NAME = ? LIMIT 1`,
      { replacements: [OLD_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (oldExisting.length > 0) {
      try { await queryInterface.removeIndex('idempotency_keys', OLD_INDEX); } catch { /* ok */ }
    }

    const newExisting = await sequelize.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'idempotency_keys'
          AND INDEX_NAME = ? LIMIT 1`,
      { replacements: [NEW_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (newExisting.length === 0) {
      await queryInterface.addIndex(
        'idempotency_keys',
        ['key', 'actor_id', 'operation', 'resource_id'],
        { unique: true, name: NEW_INDEX }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const sequelize = queryInterface.sequelize;
    const OLD_INDEX = 'idx_idemp_key_actor_op';
    const NEW_INDEX = 'idx_idemp_key_actor_op_res';

    const existing = await sequelize.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'idempotency_keys'
          AND INDEX_NAME = ? LIMIT 1`,
      { replacements: [NEW_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (existing.length > 0) {
      try { await queryInterface.removeIndex('idempotency_keys', NEW_INDEX); } catch { /* ok */ }
    }

    await queryInterface.changeColumn('idempotency_keys', 'resource_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: null,
    });

    // Restore legacy unique if absent.
    const oldExisting = await sequelize.query(
      `SELECT INDEX_NAME FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'idempotency_keys'
          AND INDEX_NAME = ? LIMIT 1`,
      { replacements: [OLD_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (oldExisting.length === 0) {
      await queryInterface.addIndex(
        'idempotency_keys',
        ['key', 'actor_id', 'operation'],
        { unique: true, name: OLD_INDEX }
      );
    }
  },
};
