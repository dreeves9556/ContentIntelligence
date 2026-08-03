-- AlterTable: add idempotency claim state to calendar_generation_logs
ALTER TABLE "calendar_generation_logs" ADD COLUMN "requestId" TEXT,
ADD COLUMN "requestStatus" TEXT,
ADD COLUMN "requestClaimToken" TEXT,
ADD COLUMN "requestClaimedAt" TIMESTAMP(3),
ADD COLUMN "requestCompletedAt" TIMESTAMP(3),
ADD COLUMN "requestAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "requestDaysToPost" INTEGER,
ADD COLUMN "requestTimezoneOffset" INTEGER,
ADD COLUMN "requestUserId" TEXT,
ADD COLUMN "resultingCalendarId" TEXT;

-- CreateIndex: one claim per user+requestId (Postgres treats multiple NULLs as distinct, so existing rows are safe)
CREATE UNIQUE INDEX "calendar_generation_logs_userId_requestId_key"
  ON "calendar_generation_logs"("userId", "requestId");

-- CreateIndex: stale-lease scan
CREATE INDEX "calendar_generation_logs_requestStatus_requestClaimedAt_idx"
  ON "calendar_generation_logs"("requestStatus", "requestClaimedAt");
