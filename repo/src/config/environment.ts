// dotenv is loaded conditionally for local dev; Docker uses env_file
try { require('dotenv').config(); } catch (_) { /* dotenv not required in production */ }

export interface EnvironmentConfig {
  port: number;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    name: string;
  };
  jwtSecret: string;
  encryptionKey: string;
  jwtTtl: number;
}

function loadConfig(): EnvironmentConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    db: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'hospitality',
      password: process.env.DB_PASSWORD || 'hospitality',
      name: process.env.DB_NAME || 'hospitality',
    },
    jwtSecret: process.env.JWT_SECRET || 'change_me_in_production',
    encryptionKey: process.env.ENCRYPTION_KEY || 'change_me_32_chars_minimum_here_x',
    jwtTtl: parseInt(process.env.JWT_TTL || '28800', 10),
  };
}

export const config = loadConfig();
