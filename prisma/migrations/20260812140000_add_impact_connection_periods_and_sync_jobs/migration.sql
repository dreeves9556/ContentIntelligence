-- Track each user/platform connection era so reconnects cannot reuse an old impact baseline.
CREATE TABLE "impact_connection_periods" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL,
  "disconnectedAt" TIMESTAMP(3),
  "providerAccountId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "impact_connection_periods_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "impact_connection_periods"
  ADD CONSTRAINT "impact_connection_periods_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "impact_connection_periods_userId_platform_connectedAt_idx"
  ON "impact_connection_periods"("userId", "platform", "connectedAt");
CREATE INDEX "impact_connection_periods_platform_disconnectedAt_idx"
  ON "impact_connection_periods"("platform", "disconnectedAt");
CREATE UNIQUE INDEX "impact_connection_periods_active_unique_idx"
  ON "impact_connection_periods"("userId", "platform")
  WHERE "disconnectedAt" IS NULL;

ALTER TABLE "zernio_accounts" ADD COLUMN "connectionPeriodId" TEXT;
ALTER TABLE "member_growth_baselines" ADD COLUMN "connectionPeriodId" TEXT;

-- Give every currently connected account a deterministic active period. Historical
-- rows remain untouched and can still be audited by user/platform/date.
INSERT INTO "impact_connection_periods" (
  "id", "userId", "platform", "connectedAt", "providerAccountId", "createdAt", "updatedAt"
)
SELECT
  md5("userId" || '|' || "platform" || '|' || "connectedAt"::text),
  "userId",
  "platform",
  "connectedAt",
  "zernioAccountId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "zernio_accounts";

UPDATE "zernio_accounts" AS account
SET "connectionPeriodId" = md5(account."userId" || '|' || account."platform" || '|' || account."connectedAt"::text);

UPDATE "member_growth_baselines" AS baseline
SET "connectionPeriodId" = account."connectionPeriodId"
FROM "zernio_accounts" AS account
WHERE account."userId" = baseline."userId"
  AND account."platform" = baseline."platform";

ALTER TABLE "zernio_accounts"
  ADD CONSTRAINT "zernio_accounts_connectionPeriodId_fkey"
  FOREIGN KEY ("connectionPeriodId") REFERENCES "impact_connection_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "member_growth_baselines"
  ADD CONSTRAINT "member_growth_baselines_connectionPeriodId_fkey"
  FOREIGN KEY ("connectionPeriodId") REFERENCES "impact_connection_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "zernio_accounts_connectionPeriodId_key"
  ON "zernio_accounts"("connectionPeriodId");
CREATE INDEX "zernio_accounts_connectionPeriodId_idx"
  ON "zernio_accounts"("connectionPeriodId");
CREATE INDEX "member_growth_baselines_connectionPeriodId_idx"
  ON "member_growth_baselines"("connectionPeriodId");

-- Durable, bounded, lease-recoverable analytics sync work.
CREATE TABLE "analytics_sync_jobs" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "connectionPeriodId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "postsSynced" INTEGER NOT NULL DEFAULT 0,
  "followerPointsSynced" INTEGER NOT NULL DEFAULT 0,
  "analyticsSucceeded" BOOLEAN NOT NULL DEFAULT false,
  "followerStatsSucceeded" BOOLEAN NOT NULL DEFAULT false,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_sync_jobs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "analytics_sync_jobs"
  ADD CONSTRAINT "analytics_sync_jobs_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_sync_jobs"
  ADD CONSTRAINT "analytics_sync_jobs_connectionPeriodId_fkey"
  FOREIGN KEY ("connectionPeriodId") REFERENCES "impact_connection_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "analytics_sync_jobs_status_scheduledFor_idx"
  ON "analytics_sync_jobs"("status", "scheduledFor");
CREATE INDEX "analytics_sync_jobs_status_claimedAt_idx"
  ON "analytics_sync_jobs"("status", "claimedAt");
CREATE INDEX "analytics_sync_jobs_userId_platform_status_idx"
  ON "analytics_sync_jobs"("userId", "platform", "status");
CREATE UNIQUE INDEX "analytics_sync_jobs_active_account_idx"
  ON "analytics_sync_jobs"("userId", "platform")
  WHERE "status" IN ('PENDING', 'PROCESSING');
