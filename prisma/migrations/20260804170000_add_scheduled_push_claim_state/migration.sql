-- Add bounded recoverable claim state to scheduled_push_notifications.
--
-- Previously the cron route claimed EVERY due PENDING row via updateMany
-- (PENDING → PROCESSING) and then fetched only `take: 20`. Any rows beyond
-- 20 remained PROCESSING forever — no lease, no stale recovery, no token.
-- A worker crash also left rows stuck in PROCESSING permanently.
--
-- This migration adds:
--   claimToken — held by the worker that may finalize the row (SENT/FAILED)
--   claimedAt  — lease start; stale PROCESSING rows are reclaimable after a timeout
--   attempts   — incremented on each (re)claim for observability
--   lastError  — recorded when a send fails
--
-- Safe because all new columns are nullable / have defaults, so existing
-- rows (PENDING, SENT, CANCELLED, FAILED) are untouched and remain valid.
-- The new PROCESSING status value is only written by the new claim logic.

ALTER TABLE "scheduled_push_notifications" ADD COLUMN "claimToken" TEXT,
ADD COLUMN "claimedAt" TIMESTAMP(3),
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastError" TEXT;

-- Index for the stale-PROCESSING lease scan (status + claimedAt).
CREATE INDEX "scheduled_push_notifications_status_claimedAt_idx"
  ON "scheduled_push_notifications"("status", "claimedAt");
