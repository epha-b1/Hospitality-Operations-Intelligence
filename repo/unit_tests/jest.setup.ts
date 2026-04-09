/**
 * Per-suite teardown for unit tests.
 *
 * Jest spins up a worker per test file. When the file finishes, the worker
 * must exit cleanly — any dangling handle (winston Console stream, async
 * hooks store, intervals, etc.) produces the noisy "worker process has
 * failed to exit gracefully" warning.
 *
 * This file is registered via `setupFilesAfterEach` in `jest.config.js`
 * for the unit project and runs once per test file. It closes the
 * singleton winston logger so the stdout transport stream can be released.
 *
 * If the warning ever recurs, run with `--detectOpenHandles` to get a
 * stack trace for the leaking resource — see `docs/final-acceptance-hardening.md`.
 */
import { logger } from '../src/utils/logger';

afterAll(() => {
  // Close winston transports — the default Console transport holds a
  // writable stream that, under parallel worker shutdown, can keep the
  // worker alive long enough for jest to force-exit it.
  try {
    logger.close();
  } catch {
    /* already closed — safe to ignore */
  }
});
