// Plain JS config for sequelize-cli — reads env vars directly
// In Docker, env vars are set by docker-compose env_file
// In local dev, dotenv is loaded if available
try { require('dotenv').config(); } catch (_) { /* dotenv optional */ }

module.exports = {
  development: {
    username: process.env.DB_USER || 'hospitality',
    password: process.env.DB_PASSWORD || 'hospitality',
    database: process.env.DB_NAME || 'hospitality',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
  },
  production: {
    username: process.env.DB_USER || 'hospitality',
    password: process.env.DB_PASSWORD || 'hospitality',
    database: process.env.DB_NAME || 'hospitality',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',
  },
};
