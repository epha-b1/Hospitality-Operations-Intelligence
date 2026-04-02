'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
      },
      action: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      resource_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
      },
      detail: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      trace_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('audit_logs', ['created_at']);
    await queryInterface.addIndex('audit_logs', ['actor_id']);
    await queryInterface.addIndex('audit_logs', ['trace_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
