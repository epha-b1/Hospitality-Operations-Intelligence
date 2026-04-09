# Audit Remediation Changelog

This document summarizes the fixes applied in response to
`.tmp/static-audit-report.md`. It is grouped by issue letter (A–G) as
defined in the remediation brief.

---

## A) Audit redaction + immutability

### Deep masking (query and export)

**Files:**
- `src/utils/masking.ts` *(new)* — `maskSensitiveDeep()` recursively walks
  nested objects/arrays, case-insensitive substring match against
  `password`, `secret`, `token`, `apikey`, `authorization`, `credential`,
  `private_key`, `encryption_key`, `session`, `cookie`, `otp`, `pin`,
  `ssn`. Handles cycles.
- `src/controllers/audit.controller.ts` — both `queryLogs` and
  `exportLogs` now call `maskSensitiveDeep(r.detail)`. Export was
  previously emitting raw `detail`; now it uses the shared masking and
  the shared `objectsToCsv` serializer.

### App-level immutability hooks

**Files:**
- `src/models/audit.model.ts` — `beforeUpdate`, `beforeDestroy`,
  `beforeBulkUpdate`, `beforeBulkDestroy`, and `beforeSave` (new) all
  throw `AppError(500, 'AUDIT_IMMUTABLE', ...)`. `beforeSave` guards
  against no-op `save()` calls on existing instances that can sidestep
  `beforeUpdate` in some sequelize versions.

### DB-level immutability

**Files:**
- `migrations/017-audit-logs-immutability.js` *(new)* — creates two
  MySQL triggers:
  - `audit_logs_block_update`: rejects ALL updates.
  - `audit_logs_block_delete`: rejects deletes of rows newer than
    1 year (lets the retention job archive old rows).
- `docs/audit-immutability.md` *(new)* — documents layered enforcement,
  production `REVOKE`/`GRANT` SQL, and a 6-step verification checklist.

### Tests

**New:**
- `unit_tests/masking.spec.ts` — 9 tests covering primitives, shallow
  and nested masking, arrays, case-insensitive keys, variants
  (`password_hash`, `api_key`, `encryption_key`, `private_key`),
  non-mutation of input, circular references.
- `unit_tests/audit-immutability.spec.ts` — verifies every hook throws
  with the `AUDIT_IMMUTABLE` code and that `beforeSave` allows inserts
  but blocks in-place updates.

**Updated:**
- `API_tests/audit.api.spec.ts` — seeds an audit record with sensitive
  fields nested 3 levels deep (object + array), asserts both the JSON
  query and the CSV export redact them, verifies no raw secret value
  appears in either serialization, confirms ORM-level `update`/`destroy`
  are rejected and the seeded row is still intact afterward, and checks
  formula injection neutralization via a seeded `=HYPERLINK(...)` action.

### Supporting mock change

- `src/__mocks__/sequelize.mock.ts` — added hook registration mock
  (`beforeUpdate`, `beforeDestroy`, `beforeBulkUpdate`,
  `beforeBulkDestroy`, `beforeSave`) with per-subclass hook storage so
  `unit_tests/audit-immutability.spec.ts` can inspect the registered
  hooks without needing a real DB.

---

## B) Manager property isolation in `evaluationReport`

**Files:**
- `src/services/import.service.ts` — `evaluationReport()` now accepts a
  `propertyId` and, when present, filters via
  `EXISTS (SELECT 1 FROM staffing_records s WHERE s.employee_id = e.employee_id AND s.property_id = ?)`.
  Previously the parameter was ignored.

The controller path (`src/controllers/import.controller.ts`) already
invoked `enforceManagerScope(req)` — the bug was only that the service
silently dropped the filter.

**Tests (updated):**
- `API_tests/reports.api.spec.ts`:
  - New test: `GET /reports/evaluations?propertyId=<other>` as manager
    returns 403.
  - New test: manager and admin queries show that the manager's
    result-set cardinality is `<=` admin's, proving the filter is wired
    through.

---

## C) Rate limiter ordering

**Files:**
- `src/middleware/rate-limit.middleware.ts` — split into three limiters:
  - `generalLimiter`: global IP-based safety net (app-level).
  - `userLimiter`: per-`req.user.id` limit; must be mounted *after*
    `authMiddleware`.
  - `authLimiter`: unchanged per-IP auth-endpoint limit.
- `src/app.ts` — comment clarifies that `generalLimiter` is the
  IP-based safety net and per-user quotas live on protected routers.
- Protected routers updated to mount `userLimiter` **after**
  `authMiddleware`:
  - `src/routes/accounts.routes.ts` (replaced inline auth with
    `router.use(auth)` + `router.use(userLimiter)`)
  - `src/routes/audit.routes.ts`
  - `src/routes/face.routes.ts`
  - `src/routes/files.routes.ts`
  - `src/routes/groups.routes.ts`
  - `src/routes/import.routes.ts`
  - `src/routes/itineraries.routes.ts`
  - `src/routes/notifications.routes.ts`
  - `src/routes/quality.routes.ts`
  - `src/routes/reports.routes.ts`
  - `src/routes/users.routes.ts`
- `.env.example` — documents `RATE_LIMIT_GENERAL_IP`, `RATE_LIMIT_USER`,
  `RATE_LIMIT_AUTH`.

---

## D) CSV export safety

**Files:**
- `src/utils/csv.ts` *(new)* — `csvEscapeCell`, `rowsToCsv`,
  `objectsToCsv`. Every cell is double-quoted (RFC 4180), embedded
  quotes are doubled, and values that start with `=`, `+`, `-`, `@`,
  tab, or CR are prefixed with `'` to neutralize spreadsheet formula
  injection.
- `src/controllers/audit.controller.ts` — audit export uses
  `objectsToCsv`.
- `src/controllers/reports.controller.ts` — report CSV export uses
  `objectsToCsv` instead of `Object.values().join(',')`.

**Tests:**
- `unit_tests/csv.spec.ts` *(new)* — 16 tests for escaping, quoting,
  formula neutralization (including `=`, `+`, `-`, `@`, leading tab),
  object-to-CSV pipeline, headers-only, missing keys, and dangerous
  values.
- `API_tests/audit.api.spec.ts` — verifies `=HYPERLINK(...)` is
  neutralized in the audit export.

---

## E) Account profile validation

**Files:**
- `src/utils/validation.ts` — new `updateProfileSchema` enforcing:
  - 2-letter uppercase US state code from a full valid list (incl. DC
    and territories)
  - US ZIP or ZIP+4 (`^\d{5}(-\d{4})?$`)
  - ISO 4217 3-letter uppercase currency code
  - reasonable length bounds matching the DB columns
  - strict mode (unknown fields rejected)
- `src/routes/accounts.routes.ts` — applies `validate(updateProfileSchema)`
  to `PATCH /accounts/me`.

**Tests:**
- `unit_tests/account-profile.spec.ts` *(new)* — 10 tests for valid
  payloads, ZIP/ZIP+4, state codes (full + territories), ISO currency,
  length bounds, unknown fields, partial updates.
- `API_tests/auth.api.spec.ts` — 5 new API tests for valid payload, bad
  state, bad ZIP, bad currency, and unknown field.

---

## F) Import temp artifact hygiene

**Files:**
- `src/services/import.service.ts`:
  - Replaced inline `require('fs')` / `require('path')` with top-level
    imports.
  - New `IMPORT_TMP_DIR = path.resolve('var/import-tmp')` constant —
    guarantees all staged files live under one isolated directory, not
    `exports/`.
  - `tmpFilePath(batchId)` validates UUID shape and enforces path
    containment inside the tmp dir to defeat traversal.
  - `commitBatch` now unlinks the staged file even on the failed-retry
    path so PII does not linger after a failure.
  - New exported `cleanupStaleImportTmp(maxAgeMs)` helper.
- `src/jobs/cleanup.ts`:
  - New `cleanupImportTmp` cron job (every hour at :15).
  - `cleanupExports` now sweeps any stray `.import-*` files that may
    exist under `exports/` regardless of age (legacy drift).
- `.gitignore` — added `var/` with `var/.gitkeep` exception.
- `var/import-tmp/` directory created on disk; `var/.gitkeep` added.
- Removed 16 stale `.import-*.json` files from `repo/exports/`.

**Tests:**
- `unit_tests/import-tmp.spec.ts` *(new)* — 4 tests verifying stale
  file deletion, preservation of recent files, pattern-only matching,
  and no-op on missing directory.

---

## G) Documentation consistency

**Files:**
- `README.md` — rewritten to:
  - Note `.env.example` exists and is the source of env var docs.
  - Correct the test directory names (`unit_tests/`, `API_tests/`).
  - Document both `./run_tests.sh` and direct `npm run test:unit` /
    `npm run test:api` paths.
  - Include a directory-layout table that calls out `var/import-tmp/`.
  - Cross-reference `docs/audit-immutability.md` and the security
    hardening items above.
- `.env.example` — added rate limit environment variables.

---

## Verification

### Type check

```sh
cd repo
npx tsc --noEmit
```

### Unit tests (no DB required)

```sh
cd repo
npm run test:unit
# or individual suites:
npx jest --selectProjects unit --testPathPattern masking
npx jest --selectProjects unit --testPathPattern csv
npx jest --selectProjects unit --testPathPattern audit-immutability
npx jest --selectProjects unit --testPathPattern account-profile
npx jest --selectProjects unit --testPathPattern import-tmp
```

Current status: **13 suites, 118 tests — all passing.**

### API tests (require MySQL)

```sh
cd repo
./run_tests.sh
# or individual suite:
npx jest --selectProjects api --testPathPattern audit.api
npx jest --selectProjects api --testPathPattern reports.api
npx jest --selectProjects api --testPathPattern auth.api
```

### DB-level immutability verification (manual, requires running MySQL)

See `docs/audit-immutability.md` §"Verification checklist" for the
full 6-step procedure. Quick smoke test:

```sql
-- Should fail with ERROR 1644 (45000)
UPDATE audit_logs SET action = 'tampered' LIMIT 1;

-- Should fail with ERROR 1644 (45000) for any recent row
DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs ORDER BY created_at DESC LIMIT 1);
```

---

## Residual items requiring manual verification

1. **Production DB role grants** — layer 3 of the immutability stack
   (REVOKE UPDATE/DELETE from the app DB user) must be applied once by
   a DBA using the SQL in `docs/audit-immutability.md`. The migration
   cannot modify its own credential's privileges.
2. **DB clock skew** — the 1-year trigger cutoff relies on the MySQL
   server clock. Run NTP on the DB host to avoid early deletion.
3. **Backups** — ensure nightly logical backups of `audit_logs` exist
   off-host as the ultimate immutability guarantee.
4. **API tests** require a running MySQL (via `./run_tests.sh` or
   `docker compose up db -d`); unit tests run standalone.
