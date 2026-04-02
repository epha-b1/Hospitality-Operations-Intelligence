'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rounds = 12;

    const users = [
      {
        id: uuidv4(),
        username: 'admin',
        password_hash: await bcrypt.hash('Admin1!pass', rounds),
        role: 'hotel_admin',
        status: 'active',
        failed_attempts: 0,
        preferred_currency: 'USD',
        pii_export_allowed: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        username: 'manager1',
        password_hash: await bcrypt.hash('Manager1!pass', rounds),
        role: 'manager',
        status: 'active',
        failed_attempts: 0,
        preferred_currency: 'USD',
        pii_export_allowed: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        username: 'analyst1',
        password_hash: await bcrypt.hash('Analyst1!pass', rounds),
        role: 'analyst',
        status: 'active',
        failed_attempts: 0,
        preferred_currency: 'USD',
        pii_export_allowed: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: uuidv4(),
        username: 'member1',
        password_hash: await bcrypt.hash('Member1!pass', rounds),
        role: 'member',
        status: 'active',
        failed_attempts: 0,
        preferred_currency: 'USD',
        pii_export_allowed: false,
        created_at: now,
        updated_at: now,
      },
    ];

    // Only insert if no users exist (idempotent seeder)
    const existing = await queryInterface.sequelize.query(
      'SELECT COUNT(*) as cnt FROM users',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    if (existing[0].cnt === 0) {
      await queryInterface.bulkInsert('users', users);
      console.log('Demo users seeded: admin, manager1, analyst1, member1');
    } else {
      console.log('Users already exist, skipping seed');
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', {
      username: ['admin', 'manager1', 'analyst1', 'member1'],
    });
  },
};
