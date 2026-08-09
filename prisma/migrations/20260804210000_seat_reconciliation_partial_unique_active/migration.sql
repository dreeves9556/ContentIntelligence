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
--  - Pre-cleanup step below resolves any duplicate active rows that could
--    cause CREATE UNIQUE INDEX to fail. Duplicates are unlikely but possible
--    from a race condition before this migration.
--  - The old application version ignores this index (it never references it).
--
-- Note: Partial unique indexes cannot be fully represented in Prisma schema
-- syntax. This index exists only in the migration SQL. See AGENTS.md for
-- details on how to distinguish expected unsupported-schema behavior from
-- real drift.

-- Pre-cleanup: if any organization has more than one active (PENDING or
-- RECOVERY_REQUIRED) operation, keep the most recent one and mark older
-- duplicates as FAILED (terminal) so the unique index can be created.
-- The most recent op is determined by createdAt DESC; if ties, by id DESC.
-- Admins can review the lastError on the FAILED rows if follow-up is needed.
UPDATE "SeatReconciliationOperation" AS older
SET "status" = 'FAILED',
    "lastError" = COALESCE("lastError", '') ||
      ' [MIGRATION 20260804210000: Duplicate active operation demoted to FAILED to allow unique index creation. Review if follow-up needed.]'
WHERE "older"."status" IN ('PENDING', 'RECOVERY_REQUIRED')
  AND "older"."id" NOT IN (
    SELECT DISTINCT latest."id"
    FROM (
      SELECT DISTINCT ON ("organizationId")
        "id", "organizationId", "createdAt"
      FROM "SeatReconciliationOperation"
      WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED')
      ORDER BY "organizationId", "createdAt" DESC, "id" DESC
    ) AS latest
  );

CREATE UNIQUE INDEX IF NOT EXISTS "seat_reconciliation_active_unique_org_idx"
  ON "SeatReconciliationOperation" ("organizationId")
  WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED');
