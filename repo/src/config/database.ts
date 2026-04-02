import { Sequelize } from 'sequelize';
import { config } from './environment';

export const sequelize = new Sequelize(
  config.db.name,
  config.db.user,
  config.db.password,
  {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: false,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000,
    },
  }
);

export async function testConnection(): Promise<void> {
  await sequelize.authenticate();
}
