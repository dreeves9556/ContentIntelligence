-- Durable, idempotent seat-reduction operation table.
--
-- A seat reduction touches two independent systems (Stripe + the DB) and must
-- remain retryable if either side fails. This table is the single source of
-- truth for an in-flight reduction: it records the original Stripe quantity,
-- original seat limit, target quantity, selected member actions, actor, and
-- the current state-machine status. The client generates a UUID `requestId`
-- so a retry resumes the same operation instead of creating a second one.
--
-- Status state machine:
--   PENDING            — claimed, validation done, Stripe call not yet applied
--   COMPLETED          — Stripe reduced AND DB member/seatLimit changes applied
--   FAILED             — retryable: Stripe rejected/timeout (members untouched)
--                        OR Stripe succeeded + DB failed + Stripe compensation
--                        succeeded (members untouched, Stripe restored)
--   RECOVERY_REQUIRED  — Stripe succeeded + DB failed + Stripe compensation
--                        also failed. Admin must intervene.
--
-- Safe because this is a brand-new table; existing rows are unaffected.
-- All columns are nullable or have defaults so the table can be created while
-- the previous application version is still running (the old app never reads
-- or writes this table).
--
-- Mixed-version deployment: run `prisma migrate deploy` BEFORE deploying the
-- new app code that references this table. The old app ignores the table.

CREATE TABLE "seat_reconciliation_operations" (
  "id"                       TEXT NOT NULL,
  "requestId"                TEXT NOT NULL,
  "organizationId"           TEXT NOT NULL,
  "actorUserId"              TEXT NOT NULL,
  "originalSeatLimit"        INTEGER NOT NULL,
  "originalStripeQuantity"   INTEGER,
  "targetSeats"              INTEGER NOT NULL,
  "memberActionsJson"        JSONB NOT NULL,
  "status"                   TEXT NOT NULL DEFAULT 'PENDING',
  "attempts"                 INTEGER NOT NULL DEFAULT 0,
  "claimToken"               TEXT,
  "claimedAt"                TIMESTAMP(3),
  "completedAt"              TIMESTAMP(3),
  "lastError"                TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL,

  CONSTRAINT "seat_reconciliation_operations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "seat_reconciliation_operations_requestId_key"
  ON "seat_reconciliation_operations"("requestId");

CREATE INDEX "seat_reconciliation_operations_organizationId_status_idx"
  ON "seat_reconciliation_operations"("organizationId", "status");

CREATE INDEX "seat_reconciliation_operations_status_claimedAt_idx"
  ON "seat_reconciliation_operations"("status", "claimedAt");
