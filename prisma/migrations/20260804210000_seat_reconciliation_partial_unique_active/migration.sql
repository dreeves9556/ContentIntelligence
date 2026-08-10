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
--  - A non-destructive preflight check below aborts the migration if any
--    organization has more than one active operation. This is safer than
--    auto-demoting duplicates: a PENDING op may have already mutated Stripe,
--    and a RECOVERY_REQUIRED op explicitly means external and DB state may
--    disagree. Recency cannot identify the correct operation, and demotion
--    could hide it from the recovery dashboard or permit an unsafe retry.
--  - The old application version ignores this index (it never references it).
--
-- Note: Partial unique indexes cannot be fully represented in Prisma schema
-- syntax. This index exists only in the migration SQL. See AGENTS.md for
-- details on how to distinguish expected unsupported-schema behavior from
-- real drift.

-- Preflight: abort migration if any organization has more than one active
-- (PENDING or RECOVERY_REQUIRED) operation. The operator must reconcile those
-- records against live Stripe and DB state before rerunning the migration.
-- We use a DO block with RAISE EXCEPTION to halt the migration and report
-- the affected organization IDs in the error message.
DO $$
DECLARE
  dup_count  INTEGER;
  dup_orgs   TEXT;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT "organizationId"
    FROM "seat_reconciliation_operations"
    WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED')
    GROUP BY "organizationId"
    HAVING COUNT(*) > 1
  ) AS dups;

  IF dup_count > 0 THEN
    SELECT string_agg("organizationId", ', ') INTO dup_orgs
    FROM (
      SELECT DISTINCT "organizationId"
      FROM "seat_reconciliation_operations"
      WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED')
      GROUP BY "organizationId"
      HAVING COUNT(*) > 1
    ) AS dups;

    RAISE EXCEPTION
      'Migration 20260804210000 aborted: % organization(s) have duplicate active '
      'seat reconciliation operations (PENDING or RECOVERY_REQUIRED). '
      'Affected organization IDs: %. '
      'Manually reconcile these operations against live Stripe and DB state '
      '(complete or fail the correct one via the admin recovery dashboard) '
      'before rerunning this migration.',
      dup_count, dup_orgs;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "seat_reconciliation_active_unique_org_idx"
  ON "seat_reconciliation_operations" ("organizationId")
  WHERE "status" IN ('PENDING', 'RECOVERY_REQUIRED');
