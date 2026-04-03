import { sequelize } from '../src/config/database';

// Shared setup: verify DB is reachable before running API tests.
// If no DB available, tests will fail with a clear message rather than ECONNREFUSED noise.
beforeAll(async () => {
  try {
    await sequelize.authenticate();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('ECONNREFUSED')) {
      console.error(
        '\n╔══════════════════════════════════════════════════════════════╗\n' +
        '║  API tests require a running MySQL database.               ║\n' +
        '║  Run tests inside Docker:  ./run_tests.sh                  ║\n' +
        '║  Or start MySQL locally:   docker compose up db -d         ║\n' +
        '╚══════════════════════════════════════════════════════════════╝\n'
      );
    }
    throw err;
  }
});

afterAll(async () => {
  await sequelize.close();
});
