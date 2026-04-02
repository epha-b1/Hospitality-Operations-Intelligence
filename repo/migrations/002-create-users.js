'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      role: {
        type: Sequelize.ENUM('hotel_admin', 'manager', 'analyst', 'member'),
        allowNull: false,
        defaultValue: 'member',
      },
      property_id: {
        type: Sequelize.STRING(36),
        allowNull: true,
      },
      legal_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address_line1: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address_line2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(2),
        allowNull: true,
      },
      zip: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      tax_invoice_title: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      preferred_currency: {
        type: Sequelize.STRING(3),
        allowNull: true,
        defaultValue: 'USD',
      },
      pii_export_allowed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'suspended', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
      failed_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('users', ['username']);
    await queryInterface.addIndex('users', ['status']);
    await queryInterface.addIndex('users', ['deleted_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
