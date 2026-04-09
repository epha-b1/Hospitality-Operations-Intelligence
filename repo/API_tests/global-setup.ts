/**
 * Jest globalSetup for the `api` project.
 *
 * Runs ONCE before any API test files are loaded. Its only job is to probe
 * the MySQL connection and record whether the database is reachable via an
 * environment variable (`DB_AVAILABLE=1|0`) that worker processes inherit.
 *
 * Each spec file uses the `describeDb` helper from `./db-guard.ts` so that
 * when the DB is unreachable the entire test block is cleanly marked as
 * skipped rather than collapsing with a wall of ECONNREFUSED failures and
 * misleading beforeAll errors.
 *
 * This preserves the strict "no fake passes" posture — tests that need the
 * DB are *skipped*, not *passed* — while making the failure mode reviewer-
 * friendly. Use `./run_tests.sh` or `docker compose up db -d` to run them
 * for real.
 */
import { sequelize } from '../src/config/database';

export default async function globalSetup(): Promise<void> {
  try {
    await sequelize.authenticate();
    process.env.DB_AVAILABLE = '1';
  } catch (err) {
    process.env.DB_AVAILABLE = '0';
    const msg = err instanceof Error ? err.message : String(err);
    // Single loud banner — not one per spec file. Printed to stderr so it
    // lands above the jest summary when the pipeline is tailing output.
    process.stderr.write(
      '\n╔════════════════════════════════════════════════════════════════╗\n' +
      '║  API tests require a running MySQL database.                   ║\n' +
      '║  DB probe FAILED — all API tests will be SKIPPED this run.     ║\n' +
      '║                                                                 ║\n' +
      '║  To run them for real:                                          ║\n' +
      '║    ./run_tests.sh                      (Docker-wrapped)         ║\n' +
      '║    docker compose up db -d && npm run test:api   (local)        ║\n' +
      '║                                                                 ║\n' +
      `║  Probe error: ${msg.slice(0, 48).padEnd(48, ' ')}║\n` +
      '╚════════════════════════════════════════════════════════════════╝\n'
    );
  } finally {
    // Close the probe connection so the globalSetup process can exit
    // cleanly. Workers each open their own connection pool.
    try { await sequelize.close(); } catch { /* pool may already be down */ }
  }
}
