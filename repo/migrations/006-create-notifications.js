'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      group_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'groups', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      actor_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      event_type: {
        type: Sequelize.STRING(100),
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
      idempotency_key: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('notifications', ['group_id', 'created_at']);
    await queryInterface.addIndex('notifications', ['idempotency_key']);

    await queryInterface.createTable('notification_reads', {
      notification_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'notifications', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notification_reads');
    await queryInterface.dropTable('notifications');
  },
};
