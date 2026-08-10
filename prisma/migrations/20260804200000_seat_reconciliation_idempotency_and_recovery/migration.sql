-- Add persisted Stripe idempotency keys and admin-recovery audit fields to
-- the seat_reconciliation_operations table.
--
-- Problem solved:
--  1. The original code derived the Stripe idempotency key from the attempt
--     counter (`seat_reconcile_main_${id}_${attempts}`). On a stale-worker
--     reclaim, the attempt counter increments, producing a NEW key for the
--     SAME logical provider mutation. If the original Stripe call timed out
--     with an unknown outcome, a retry with a different key could double-charge
--     or double-mutate. Persisting the key ensures every retry of the same
--     logical mutation reuses the same key.
--  2. `originalStripeQuantity` and `originalSeatLimit` were overwritten on
--     retry, destroying recovery evidence. The columns already exist; the
--     application logic is changed to set them only while NULL. No schema
--     change needed for that.
--  3. There was no admin tooling to discover or resolve RECOVERY_REQUIRED
--     operations. New audit fields record who resolved an operation, when,
--     and how.
--
-- New columns (all nullable / defaulted — existing rows remain valid):
--  mainIdempotencyKey        — persisted key for the main Stripe reduction
--  compensationIdempotencyKey — persisted key for compensation (restore original)
--  recoveryIdempotencyKey    — persisted key for admin-initiated recovery restore
--  recoveryClaimToken        — guards concurrent admin recovery (conditional update)
--  recoveryClaimedAt         — lease timestamp for recovery claim
--  resolvedAt                — when an admin resolved a RECOVERY_REQUIRED op
--  resolvedByUserId          — which admin resolved it
--  resolutionType            — "RESTORE_ORIGINAL" | "COMPLETED_DB"
--  resolutionSummary         — safe human-readable summary of what was done
--
-- Safe because:
--  - All new columns are nullable or have defaults; existing rows are valid.
--  - The old application version ignores these columns (it never reads/writes them).
--  - No existing column is modified or removed.
--  - No foreign keys are added (recovery evidence must survive org/user deletion).
--
-- Mixed-version deployment: run `prisma migrate deploy` BEFORE deploying the
-- new app code that references these columns. The old app ignores them.

ALTER TABLE "seat_reconciliation_operations"
  ADD COLUMN "mainIdempotencyKey"        TEXT,
  ADD COLUMN "compensationIdempotencyKey" TEXT,
  ADD COLUMN "recoveryIdempotencyKey"    TEXT,
  ADD COLUMN "recoveryClaimToken"        TEXT,
  ADD COLUMN "recoveryClaimedAt"         TIMESTAMP(3),
  ADD COLUMN "resolvedAt"                TIMESTAMP(3),
  ADD COLUMN "resolvedByUserId"          TEXT,
  ADD COLUMN "resolutionType"            TEXT,
  ADD COLUMN "resolutionSummary"         TEXT;

-- Index for admin recovery discovery: find RECOVERY_REQUIRED rows by status.
-- The existing index on (status, claimedAt) covers status lookups; add a
-- dedicated index for recovery claim stale-lease lookups.
CREATE INDEX "seat_reconciliation_operations_recovery_claim_idx"
  ON "seat_reconciliation_operations"("status", "recoveryClaimedAt")
  WHERE "status" = 'RECOVERY_REQUIRED';
