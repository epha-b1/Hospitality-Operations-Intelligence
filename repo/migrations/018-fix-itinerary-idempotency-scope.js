'use strict';

/**
 * Fix cross-tenant idempotency isolation for itinerary creation.
 *
 * Original schema (migration 007) had a global UNIQUE constraint on
 * `itinerary_items.idempotency_key`. That meant an idempotency key
 * coined by user A in group G1 could collide with — or, worse, return
 * the wrong row to — a request from user B in group G2 that happened
 * to use the same key. The audit flagged this as a tenant-isolation
 * defect.
 *
 * Fix: replace the global unique with a composite unique on
 *   (group_id, created_by, idempotency_key)
 *
 * This is the strictest scope that still preserves correct replay
 * semantics for the same caller (same user, same group, same key →
 * same row). Different group OR different user → different rows even
 * if the key string happens to match.
 *
 * The accompanying service change in src/services/itinerary.service.ts
 * matches by all three columns when looking up an existing item, so
 * the unique index and the lookup query agree. The model `indexes`
 * option also declares the same composite index so `sequelize.sync()`
 * (used by some test environments) produces the right schema.
 *
 * ── Robustness ────────────────────────────────────────────────────
 *
 * Migration 007 set the column-level `unique: true`, which causes
 * MySQL to create an index whose name varies by Sequelize version
 * (`idempotency_key`, `itinerary_items_idempotency_key`,
 * `itinerary_items_idempotency_key_unique`, …) and an additional
 * non-unique index from the explicit `addIndex(...)` call. We can't
 * predict the exact name. Instead the up() step inspects
 * information_schema and drops every index whose ONLY column is
 * `idempotency_key`. This is safe (we never touch the new composite
 * because that index has three columns).
 *
 * Up + down are both written to be re-runnable: if the index already
 * exists with the right columns the up() step is a no-op; same for
 * down().
 */
module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const NEW_INDEX = 'idx_itinerary_items_scope_idempotency';

    // 1) Drop every legacy index whose ONLY column is `idempotency_key`.
    //    Anything that includes additional columns (e.g. our new composite
    //    or a future multi-column index) is left alone.
    const legacy = await sequelize.query(
      `
        SELECT s.INDEX_NAME
        FROM information_schema.statistics s
        WHERE s.TABLE_SCHEMA = DATABASE()
          AND s.TABLE_NAME   = 'itinerary_items'
          AND s.INDEX_NAME   <> 'PRIMARY'
          AND s.COLUMN_NAME  = 'idempotency_key'
          AND (
            SELECT COUNT(*) FROM information_schema.statistics s2
            WHERE s2.TABLE_SCHEMA = s.TABLE_SCHEMA
              AND s2.TABLE_NAME   = s.TABLE_NAME
              AND s2.INDEX_NAME   = s.INDEX_NAME
          ) = 1
        GROUP BY s.INDEX_NAME
      `,
      { type: sequelize.QueryTypes.SELECT }
    );

    for (const row of legacy) {
      const name = row.INDEX_NAME;
      if (name === NEW_INDEX) continue;
      // Use a quoted DROP INDEX statement so any reasonable name works.
      await sequelize.query(
        `ALTER TABLE \`itinerary_items\` DROP INDEX \`${name}\``
      );
    }

    // 2) Drop a UNIQUE *constraint* (not just index) if MySQL exposes
    //    one. CONSTRAINT and INDEX usually share names but we try
    //    both forms to be safe across server versions.
    const constraints = await sequelize.query(
      `
        SELECT CONSTRAINT_NAME
        FROM information_schema.table_constraints
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = 'itinerary_items'
          AND CONSTRAINT_TYPE = 'UNIQUE'
          AND CONSTRAINT_NAME <> '${NEW_INDEX}'
      `,
      { type: sequelize.QueryTypes.SELECT }
    );
    for (const row of constraints) {
      // Confirm it covers only idempotency_key before dropping.
      const cols = await sequelize.query(
        `SELECT COLUMN_NAME FROM information_schema.key_column_usage
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = 'itinerary_items'
           AND CONSTRAINT_NAME = ?`,
        { replacements: [row.CONSTRAINT_NAME], type: sequelize.QueryTypes.SELECT }
      );
      if (cols.length === 1 && cols[0].COLUMN_NAME === 'idempotency_key') {
        try {
          await sequelize.query(
            `ALTER TABLE \`itinerary_items\` DROP INDEX \`${row.CONSTRAINT_NAME}\``
          );
        } catch { /* may already be gone via step 1 */ }
      }
    }

    // 3) Add the composite unique — if it already exists (re-run), skip.
    const existing = await sequelize.query(
      `
        SELECT INDEX_NAME
        FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'itinerary_items'
          AND INDEX_NAME = ?
        LIMIT 1
      `,
      { replacements: [NEW_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (existing.length === 0) {
      await queryInterface.addIndex('itinerary_items', ['group_id', 'created_by', 'idempotency_key'], {
        unique: true,
        name: NEW_INDEX,
      });
    }
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const NEW_INDEX = 'idx_itinerary_items_scope_idempotency';

    // Drop the composite if present.
    const existing = await sequelize.query(
      `
        SELECT INDEX_NAME
        FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'itinerary_items'
          AND INDEX_NAME = ?
        LIMIT 1
      `,
      { replacements: [NEW_INDEX], type: sequelize.QueryTypes.SELECT }
    );
    if (existing.length > 0) {
      try {
        await queryInterface.removeIndex('itinerary_items', NEW_INDEX);
      } catch { /* not present */ }
    }

    // Restore original (incorrect) global unique for dev rollback.
    // Only does anything if a same-name index doesn't already exist.
    const restore = await sequelize.query(
      `
        SELECT INDEX_NAME FROM information_schema.statistics
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'itinerary_items'
          AND INDEX_NAME = 'idempotency_key'
        LIMIT 1
      `,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (restore.length === 0) {
      await queryInterface.addIndex('itinerary_items', ['idempotency_key'], {
        unique: true,
        name: 'idempotency_key',
      });
    }
  },
};
