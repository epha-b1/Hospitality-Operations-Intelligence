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

/**
 * Build a one-off Sequelize instance authenticated as the elevated audit
 * maintainer role (see `.env.example::AUDIT_MAINTAINER_USER`). The caller
 * owns the lifetime of the returned instance and MUST call `.close()`
 * when finished to release the pool.
 *
 * Returns null when no maintainer credential is configured — callers
 * should fall back to the main pool in that case. The fallback is safe
 * because the DB trigger installed by migration 017 independently
 * enforces the 1-year retention window regardless of which user issues
 * the DELETE statement.
 */
export function createAuditMaintainerConnection(): Sequelize | null {
  const { user, password } = config.auditMaintainer;
  if (!user || !password) return null;

  return new Sequelize(config.db.name, user, password, {
    host: config.db.host,
    port: config.db.port,
    dialect: 'mysql',
    logging: false,
    // Small pool — this credential is only used by the archival cron,
    // which issues two statements per run.
    pool: { min: 0, max: 2, acquire: 30000, idle: 5000 },
  });
}
