'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create archive table with identical schema
    await queryInterface.createTable('audit_logs_archive', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      actor_id: { type: Sequelize.STRING(36), allowNull: true },
      action: { type: Sequelize.STRING(255), allowNull: false },
      resource_type: { type: Sequelize.STRING(100), allowNull: true },
      resource_id: { type: Sequelize.STRING(36), allowNull: true },
      detail: { type: Sequelize.JSON, allowNull: true },
      trace_id: { type: Sequelize.STRING(36), allowNull: true },
      ip_address: { type: Sequelize.STRING(45), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      archived_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs_archive', ['created_at']);

    // Document: App DB role should only have INSERT on audit_logs.
    // In production, run: REVOKE UPDATE, DELETE ON hospitality.audit_logs FROM 'hospitality'@'%';
    // For dev/test, this is documented but not enforced to avoid breaking test cleanup.
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs_archive');
  },
};
