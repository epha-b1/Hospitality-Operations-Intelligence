'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('files', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      group_id: { type: Sequelize.STRING(36), allowNull: true, references: { model: 'groups', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL' },
      uploaded_by: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      original_name: { type: Sequelize.STRING(255), allowNull: false },
      mime_type: { type: Sequelize.STRING(100), allowNull: false },
      size_bytes: { type: Sequelize.INTEGER, allowNull: false },
      sha256: { type: Sequelize.STRING(64), allowNull: false },
      storage_path: { type: Sequelize.STRING(500), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('files', ['group_id']);
    await queryInterface.addIndex('files', ['sha256', 'group_id'], { unique: true });

    await queryInterface.createTable('file_access_log', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      file_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'files', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'CASCADE' },
      action: { type: Sequelize.STRING(50), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('file_access_log', ['file_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('file_access_log');
    await queryInterface.dropTable('files');
  },
};
