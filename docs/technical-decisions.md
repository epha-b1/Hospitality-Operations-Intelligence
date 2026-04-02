# Technical Decisions — Hospitality Operations Intelligence

Decisions made to resolve gaps, inconsistencies, or missing pieces in the design/API docs.
These are not business-logic ambiguities (those live in `questions.md`) — these are implementation-level resolutions.

---

## TD-1. Face Enrollment Sessions — Missing Data Model

**Gap:** The face enrollment flow is multi-step (start -> capture x3 -> complete), but the original data model only had `face_enrollments` (the final result). No table for in-progress session state.

**Resolution:** Added `face_enrollment_sessions` table to `design.md` with status tracking (`in_progress | completed | expired`), per-angle liveness results in JSON, and a 30-minute session expiry. Expired sessions are cleaned up by a background job.

**Affected docs:** `design.md` (data model + background jobs), `structure.md` (face.model.ts), `AI-self-test.md`

---

## TD-2. Operational Metrics — Missing Data Model

**Gap:** The prompt requires "operational metrics for job duration, queue depth, and DB resource usage" stored in DB, but no table existed.

**Resolution:** Added `operational_metrics` table to `design.md` with metric_name, metric_value, labels (JSON), trace_id, and recorded_at. Background jobs record their duration after each run. Added `GET /metrics` endpoint (hotel_admin only) to `api-spec.md`.

**Affected docs:** `design.md` (data model + indexes), `api-spec.md`, `structure.md` (metric.model.ts, metric.service.ts), `AI-self-test.md`

---

## TD-3. Export Records — Missing Data Model

**Gap:** The prompt says exports are "logged with who/when/filters used" and exports need to be downloadable. No table tracked export files for cleanup or re-download.

**Resolution:** Added `export_records` table to `design.md` tracking user_id, export_type, format, filters (JSON), file_path, and expires_at. Added `GET /exports/:id` download endpoint to `api-spec.md`. The export cleanup job deletes files past `expires_at`.

**Affected docs:** `design.md` (data model + background jobs), `api-spec.md`, `structure.md` (export.model.ts, export.service.ts, exports.controller.ts, exports.routes.ts), `AI-self-test.md`

---

## TD-4. Notification Cursor — Reconciled to Composite Cursor

**Gap:** `design.md` section 6 originally said `cursor = last notification ID` using `id > cursor`, but UUID v4 IDs are not lexically sortable. `questions.md` Q12 proposed a composite `{created_at, id}` approach. These contradicted each other.

**Resolution:** Updated `design.md` notification flow to use the composite cursor: base64-encoded `{created_at, id}`, queried with `(created_at > :ts) OR (created_at = :ts AND id > :id)`. This is the canonical approach — stable under concurrent inserts.

**Affected docs:** `design.md` (key flows section)

---

## TD-5. Checkpoint Update/Delete — Missing API Endpoints

**Gap:** `questions.md` Q5 described checkpoint reordering via PATCH, but `api-spec.md` only had GET and POST for checkpoints. No way to update or delete individual checkpoints.

**Resolution:** Added `PATCH` and `DELETE` for `/groups/{groupId}/itineraries/{itemId}/checkpoints/{checkpointId}` to `api-spec.md`.

**Affected docs:** `api-spec.md`

---

## TD-6. Export Archive Download — Missing API Endpoint

**Gap:** `questions.md` Q13 mentioned `GET /exports/:archiveId` as the download URL, but this endpoint wasn't in `api-spec.md`.

**Resolution:** Added `GET /exports/{id}` to `api-spec.md`. Requires auth; only the creating user or hotel_admin can download. Returns 404 if expired.

**Affected docs:** `api-spec.md`

---

## TD-7. Idempotency Keys — Separate Table for Update Operations

**Gap:** `design.md` had `idempotency_key` as a column on `itinerary_items` (for create dedup), but `questions.md` Q17 proposed a separate `idempotency_keys` table for update operations with response replay.

**Resolution:** Both coexist. The UNIQUE `idempotency_key` on `itinerary_items` handles create-only dedup. The separate `idempotency_keys` table handles update idempotency with request hash matching and response replay. Added the table to `design.md`.

**Affected docs:** `design.md` (data model + indexes + background jobs for key cleanup)

---

## TD-8. Role Assignment — Missing Admin Endpoint

**Gap:** No endpoint existed for hotel_admin to assign roles, property_id, or pii_export_allowed to users. Without it, there's no way to create managers/analysts.

**Resolution:** Added `PATCH /accounts/{userId}/role` (hotel_admin only) to `api-spec.md`. Accepts role, propertyId (required for manager), and piiExportAllowed.

**Affected docs:** `api-spec.md`, `features.md`

---

## TD-9. Migration List — Incomplete

**Gap:** `structure.md` listed only 8 migrations (001-008) but the data model has 20+ tables including properties, group sub-tables, notifications, imports, quality checks, etc.

**Resolution:** Expanded to 14 migrations (001-014) with comments showing which tables each migration covers. Grouped related tables into single migrations (e.g., groups + group_members + group_required_fields + member_field_values).

**Affected docs:** `structure.md`

---

## TD-10. Missing Models/Controllers/Services/Routes in Structure

**Gap:** `structure.md` was missing: `property.model.ts`, `import.model.ts`, `quality.model.ts`, `metric.model.ts`, `export.model.ts`, `quality.controller.ts`, `audit.controller.ts`, `exports.controller.ts`, `quality.service.ts`, `metric.service.ts`, `export.service.ts`, `quality.routes.ts`, `audit.routes.ts`, `exports.routes.ts`.

**Resolution:** Added all missing files to `structure.md` in their respective directories.

**Affected docs:** `structure.md`
