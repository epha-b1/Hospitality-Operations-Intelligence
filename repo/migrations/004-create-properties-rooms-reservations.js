'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('properties', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
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
    });

    await queryInterface.createTable('rooms', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      property_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'properties', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      room_number: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      room_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      rate_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('available', 'occupied', 'maintenance'),
        allowNull: false,
        defaultValue: 'available',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('rooms', ['property_id']);
    await queryInterface.addIndex('rooms', ['status']);

    await queryInterface.createTable('reservations', {
      id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
      },
      property_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'properties', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      room_id: {
        type: Sequelize.STRING(36),
        allowNull: false,
        references: { model: 'rooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      guest_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      channel: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      check_in_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      check_out_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      rate_cents: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled'),
        allowNull: false,
        defaultValue: 'confirmed',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('reservations', ['property_id']);
    await queryInterface.addIndex('reservations', ['room_id']);
    await queryInterface.addIndex('reservations', ['check_in_date']);
    await queryInterface.addIndex('reservations', ['check_out_date']);
    await queryInterface.addIndex('reservations', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reservations');
    await queryInterface.dropTable('rooms');
    await queryInterface.dropTable('properties');
  },
};
