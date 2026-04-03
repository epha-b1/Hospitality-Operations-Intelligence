'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('face_enrollment_sessions', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' } },
      status: { type: Sequelize.ENUM('in_progress', 'completed', 'expired'), allowNull: false, defaultValue: 'in_progress' },
      angles_captured: { type: Sequelize.JSON, allowNull: false, defaultValue: '{}' },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('face_enrollment_sessions', ['user_id']);

    await queryInterface.createTable('face_enrollments', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' } },
      version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: Sequelize.ENUM('active', 'deactivated'), allowNull: false, defaultValue: 'active' },
      template_path: { type: Sequelize.STRING(500), allowNull: false },
      angles_captured: { type: Sequelize.JSON, allowNull: false },
      liveness_passed: { type: Sequelize.BOOLEAN, allowNull: false },
      liveness_meta: { type: Sequelize.JSON, allowNull: true },
      raw_image_path: { type: Sequelize.STRING(500), allowNull: true },
      raw_image_expires_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('face_enrollments', ['user_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('face_enrollments');
    await queryInterface.dropTable('face_enrollment_sessions');
  },
};
