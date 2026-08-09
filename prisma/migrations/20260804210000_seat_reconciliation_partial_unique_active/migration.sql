-- Partial unique index: at most one non-terminal operation per organization.
--
-- Non-terminal statuses are PENDING and RECOVERY_REQUIRED.
-- COMPLETED and FAILED are terminal and excluded from the index, so multiple
-- historical terminal operations for the same org coexist without violation.
--
-- This index enforces at the database level that two active reconciliations
-- cannot exist for the same organization simultaneously. The application also
-- checks for conflicts before starting/resolving, but this index is the
-- authoritative concurrency guard.
--
-- Safe because:
--  - It is a new index; no existing column is modified or removed.
--  - If any pre-existing duplicate active rows exist (unlikely but possible
--    from a race before this migration), the CREATE INDEX will fail. In that
--    case, manually resolve the duplicates (complete or fail one of them)
--    and re-run the migration.
--  - The old application version ignores this index (it never references it).
--
-- Note: Partial unique indexes cannot be fully represented in Prisma schema
-- syntax. This index exists only in the migration SQL. See AGENTS.md for
-- details on how to distinguish expected unsupported-schema behavior from
-- real drift.

CREATE UNIQUE INDEX IF NOT EXISTS "seat_reconciliation_active_unique_org_idx"
  ON "SeatReconciliationOperation" ("organizationId")
  WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED');
