'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('quality_checks', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      entity_type: { type: Sequelize.STRING(100), allowNull: false },
      check_type: { type: Sequelize.STRING(100), allowNull: false },
      config: { type: Sequelize.JSON, allowNull: false },
      result: { type: Sequelize.JSON, allowNull: true },
      passed: { type: Sequelize.BOOLEAN, allowNull: true },
      run_at: { type: Sequelize.DATE, allowNull: true },
      trace_id: { type: Sequelize.STRING(36), allowNull: true },
    });

    await queryInterface.createTable('operational_metrics', {
      id: { type: Sequelize.STRING(36), primaryKey: true, allowNull: false },
      metric_name: { type: Sequelize.STRING(255), allowNull: false },
      metric_value: { type: Sequelize.DECIMAL(15, 4), allowNull: false },
      labels: { type: Sequelize.JSON, allowNull: true },
      trace_id: { type: Sequelize.STRING(36), allowNull: true },
      recorded_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('operational_metrics', ['metric_name', 'recorded_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('operational_metrics');
    await queryInterface.dropTable('quality_checks');
  },
};
