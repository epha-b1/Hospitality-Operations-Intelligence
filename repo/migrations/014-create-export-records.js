'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('export_records', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' } },
      filename: { type: Sequelize.STRING(500), allowNull: false, unique: true },
      export_type: { type: Sequelize.STRING(50), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('export_records', ['user_id']);
    await queryInterface.addIndex('export_records', ['filename']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('export_records');
  },
};
