import app from './app';
import { config } from './config/environment';
import { testConnection } from './config/database';
import { createCategoryLogger } from './utils/logger';
import { registerCleanupJobs } from './jobs/cleanup';

const systemLogger = createCategoryLogger('system');

async function start(): Promise<void> {
  try {
    await testConnection();
    systemLogger.info('Database connection established');
  } catch (err) {
    systemLogger.error('Database connection failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  registerCleanupJobs();

  app.listen(config.port, () => {
    systemLogger.info(`Server started on port ${config.port}`);
  });
}

start();
