'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('idempotency_keys', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      key: { type: Sequelize.STRING(255), allowNull: false },
      actor_id: { type: Sequelize.STRING(36), allowNull: false },
      operation: { type: Sequelize.STRING(100), allowNull: false },
      resource_id: { type: Sequelize.STRING(255), allowNull: true },
      request_hash: { type: Sequelize.STRING(64), allowNull: false },
      response_snapshot: { type: Sequelize.JSON, allowNull: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('idempotency_keys', ['key', 'actor_id'], { unique: true, name: 'idx_idemp_key_actor' });
    await queryInterface.addIndex('idempotency_keys', ['expires_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('idempotency_keys');
  },
};
