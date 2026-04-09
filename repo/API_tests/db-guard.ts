/**
 * DB availability guard for API tests.
 *
 * The API test project probes MySQL in `global-setup.ts` and sets
 * `DB_AVAILABLE=1|0`. Each spec file imports `describeDb` and uses it
 * INSTEAD of `describe` for top-level test blocks. When DB is unavailable
 * the block is silently skipped; when available it behaves exactly like
 * the normal `describe`.
 *
 * This is strictly a skip-on-boundary mechanism. It does NOT fake a pass —
 * skipped tests appear in the jest summary as "skipped", not "passed", so
 * reviewers always see the true state of API test coverage.
 *
 * Usage:
 *   import { describeDb } from './db-guard';
 *
 *   describeDb('Feature X API', () => {
 *     test('...', async () => { ... });
 *   });
 *
 * If you want a test that always runs regardless of DB state, use the
 * bare `describe` / `test` functions — `describeDb` only gates the ones
 * you choose.
 */

export const dbAvailable: boolean = process.env.DB_AVAILABLE !== '0';

// Type matches the `describe`/`describe.skip` signatures so callers can
// use `describeDb` anywhere they would use `describe`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const describeDb: jest.Describe = (dbAvailable ? describe : describe.skip) as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const testDb: jest.It = (dbAvailable ? test : test.skip) as any;

/**
 * Throw a recognizable error from a beforeAll hook when the DB is needed
 * but absent. Used by specs that are NOT wrapped in describeDb — calling
 * it makes the failure mode explicit instead of ECONNREFUSED noise.
 */
export function requireDb(): void {
  if (!dbAvailable) {
    throw new Error(
      'API test requires a running MySQL database. ' +
      'Run `./run_tests.sh` or `docker compose up db -d` first.'
    );
  }
}
