'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('import_batches', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      user_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'users', key: 'id' } },
      batch_type: { type: Sequelize.STRING(50), allowNull: false },
      status: { type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'pending' },
      total_rows: { type: Sequelize.INTEGER, defaultValue: 0 },
      success_rows: { type: Sequelize.INTEGER, defaultValue: 0 },
      error_rows: { type: Sequelize.INTEGER, defaultValue: 0 },
      trace_id: { type: Sequelize.STRING(36), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      completed_at: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.createTable('import_errors', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      batch_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'import_batches', key: 'id' }, onDelete: 'CASCADE' },
      row_number: { type: Sequelize.INTEGER, allowNull: false },
      field: { type: Sequelize.STRING(255), allowNull: true },
      reason: { type: Sequelize.TEXT, allowNull: false },
      raw_data: { type: Sequelize.JSON, allowNull: true },
    });
    await queryInterface.addIndex('import_errors', ['batch_id']);

    await queryInterface.createTable('staffing_records', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      batch_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'import_batches', key: 'id' } },
      employee_id: { type: Sequelize.STRING(100), allowNull: false },
      effective_date: { type: Sequelize.DATEONLY, allowNull: false },
      position: { type: Sequelize.STRING(255), allowNull: false },
      department: { type: Sequelize.STRING(255), allowNull: true },
      property_id: { type: Sequelize.STRING(36), allowNull: true },
      signed_off_by: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('staffing_records', ['employee_id', 'effective_date'], { unique: true });

    await queryInterface.createTable('evaluation_records', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      batch_id: { type: Sequelize.STRING(36), allowNull: false, references: { model: 'import_batches', key: 'id' } },
      employee_id: { type: Sequelize.STRING(100), allowNull: false },
      effective_date: { type: Sequelize.DATEONLY, allowNull: false },
      score: { type: Sequelize.DECIMAL(5, 2), allowNull: true },
      result: { type: Sequelize.STRING(100), allowNull: true },
      rewards: { type: Sequelize.TEXT, allowNull: true },
      penalties: { type: Sequelize.TEXT, allowNull: true },
      signed_off_by: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('evaluation_records', ['employee_id', 'effective_date'], { unique: true });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('evaluation_records');
    await queryInterface.dropTable('staffing_records');
    await queryInterface.dropTable('import_errors');
    await queryInterface.dropTable('import_batches');
  },
};
