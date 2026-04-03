'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('itinerary_items', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      group_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING(255), allowNull: false },
      meetup_date: { type: Sequelize.STRING(10), allowNull: false },
      meetup_time: { type: Sequelize.STRING(8), allowNull: false },
      meetup_location: { type: Sequelize.TEXT, allowNull: false },
      notes: { type: Sequelize.TEXT, allowNull: true },
      meetup_sort_at: { type: Sequelize.DATE, allowNull: true },
      created_by: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      idempotency_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('itinerary_items', ['group_id']);
    await queryInterface.addIndex('itinerary_items', ['idempotency_key']);

    await queryInterface.createTable('itinerary_checkpoints', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      item_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'itinerary_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      position: { type: Sequelize.INTEGER, allowNull: false },
      label: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('itinerary_checkpoints', ['item_id']);

    await queryInterface.createTable('member_checkins', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      item_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'itinerary_items', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      checked_in_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('member_checkins', ['item_id', 'user_id'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('member_checkins');
    await queryInterface.dropTable('itinerary_checkpoints');
    await queryInterface.dropTable('itinerary_items');
  },
};
