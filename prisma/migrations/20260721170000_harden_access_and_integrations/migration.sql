-- Make Stripe webhook claiming concurrency-safe with an explicit processing lease.
ALTER TABLE "stripe_events"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PROCESSING',
ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "claimToken" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "lastError" TEXT;

-- Rows created by the previous implementation were already fully processed.
UPDATE "stripe_events" SET "status" = 'SUCCEEDED';

ALTER TABLE "stripe_events"
ALTER COLUMN "claimToken" DROP DEFAULT;

ALTER TABLE "stripe_events"
ALTER COLUMN "processedAt" DROP NOT NULL,
ALTER COLUMN "processedAt" DROP DEFAULT;

CREATE INDEX "stripe_events_status_claimedAt_idx"
ON "stripe_events"("status", "claimedAt");

-- Shared, database-backed rate limits survive deploys and work across instances.
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limit_buckets_updatedAt_idx"
ON "rate_limit_buckets"("updatedAt");

-- One-time, short-lived state for Zernio connection callbacks.
CREATE TABLE "integration_connection_states" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_connection_states_pkey" PRIMARY KEY ("tokenHash")
);

CREATE INDEX "integration_connection_states_userId_expiresAt_idx"
ON "integration_connection_states"("userId", "expiresAt");

CREATE INDEX "integration_connection_states_expiresAt_idx"
ON "integration_connection_states"("expiresAt");
