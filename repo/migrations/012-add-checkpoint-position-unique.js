'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('itinerary_checkpoints', ['item_id', 'position'], {
      unique: true,
      name: 'idx_checkpoint_item_position_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('itinerary_checkpoints', 'idx_checkpoint_item_position_unique');
  },
};
