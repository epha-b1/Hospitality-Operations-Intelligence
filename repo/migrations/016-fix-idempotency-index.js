'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Drop the old (key, actor_id) unique and replace with (key, actor_id, operation)
    try { await queryInterface.removeIndex('idempotency_keys', 'idx_idemp_key_actor'); } catch { /* may not exist */ }
    await queryInterface.addIndex('idempotency_keys', ['key', 'actor_id', 'operation'], {
      unique: true, name: 'idx_idemp_key_actor_op',
    });
  },
  async down(queryInterface) {
    try { await queryInterface.removeIndex('idempotency_keys', 'idx_idemp_key_actor_op'); } catch { /* ok */ }
    await queryInterface.addIndex('idempotency_keys', ['key', 'actor_id'], {
      unique: true, name: 'idx_idemp_key_actor',
    });
  },
};
