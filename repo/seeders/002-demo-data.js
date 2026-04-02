'use strict';

const { v4: uuidv4 } = require('uuid');

const PROPERTY_1_ID = '11111111-1111-1111-1111-111111111111';
const PROPERTY_2_ID = '22222222-2222-2222-2222-222222222222';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Check if properties already exist
    const existing = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as cnt FROM properties',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (existing[0].cnt > 0) {
      console.log('Properties already exist, skipping demo-data seed');
      return;
    }

    // Create 2 properties
    await queryInterface.bulkInsert('properties', [
      {
        id: PROPERTY_1_ID,
        name: 'Eagle Point Resort',
        address: '100 Eagle Point Dr, Aspen, CO 81611',
        created_at: now,
        updated_at: now,
      },
      {
        id: PROPERTY_2_ID,
        name: 'Lakeside Hotel',
        address: '200 Lake Shore Blvd, Lake Tahoe, CA 96150',
        created_at: now,
        updated_at: now,
      },
    ]);

    // Assign manager1 to property 1
    await queryInterface.sequelize.query(
      `UPDATE users SET property_id = '${PROPERTY_1_ID}' WHERE username = 'manager1'`
    );

    // Create rooms for property 1
    const rooms1 = [
      { id: uuidv4(), property_id: PROPERTY_1_ID, room_number: '101', room_type: 'standard', rate_cents: 15000, status: 'available', created_at: now, updated_at: now },
      { id: uuidv4(), property_id: PROPERTY_1_ID, room_number: '102', room_type: 'standard', rate_cents: 15000, status: 'occupied', created_at: now, updated_at: now },
      { id: uuidv4(), property_id: PROPERTY_1_ID, room_number: '201', room_type: 'deluxe', rate_cents: 25000, status: 'available', created_at: now, updated_at: now },
      { id: uuidv4(), property_id: PROPERTY_1_ID, room_number: '301', room_type: 'suite', rate_cents: 45000, status: 'maintenance', created_at: now, updated_at: now },
    ];

    // Create rooms for property 2
    const rooms2 = [
      { id: uuidv4(), property_id: PROPERTY_2_ID, room_number: '101', room_type: 'standard', rate_cents: 12000, status: 'available', created_at: now, updated_at: now },
      { id: uuidv4(), property_id: PROPERTY_2_ID, room_number: '102', room_type: 'standard', rate_cents: 12000, status: 'available', created_at: now, updated_at: now },
      { id: uuidv4(), property_id: PROPERTY_2_ID, room_number: '201', room_type: 'deluxe', rate_cents: 20000, status: 'occupied', created_at: now, updated_at: now },
    ];

    await queryInterface.bulkInsert('rooms', [...rooms1, ...rooms2]);

    console.log('Demo data seeded: 2 properties, 7 rooms, manager1 assigned to Eagle Point Resort');
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('rooms', null, {});
    await queryInterface.bulkDelete('properties', null, {});
    await queryInterface.sequelize.query(
      "UPDATE users SET property_id = NULL WHERE username = 'manager1'"
    );
  },
};
