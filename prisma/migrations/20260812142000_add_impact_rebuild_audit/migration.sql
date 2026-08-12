CREATE TABLE "impact_baseline_rebuild_runs" (
  "id" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PREVIEW',
  "definitionVersion" TEXT NOT NULL,
  "sourceFingerprint" TEXT NOT NULL,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "impact_baseline_rebuild_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "impact_baseline_rebuild_items" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "connectionPeriodId" TEXT,
  "oldBaselineDate" TIMESTAMP(3),
  "oldFollowerCount" INTEGER,
  "proposedDate" TIMESTAMP(3),
  "proposedFollowerCount" INTEGER,
  "proposedEngagementRate" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "impact_baseline_rebuild_items_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "impact_baseline_rebuild_items"
  ADD CONSTRAINT "impact_baseline_rebuild_items_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "impact_baseline_rebuild_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "impact_baseline_rebuild_runs_status_createdAt_idx"
  ON "impact_baseline_rebuild_runs"("status", "createdAt");
CREATE UNIQUE INDEX "impact_baseline_rebuild_items_runId_userId_platform_key"
  ON "impact_baseline_rebuild_items"("runId", "userId", "platform");
CREATE INDEX "impact_baseline_rebuild_items_userId_platform_status_idx"
  ON "impact_baseline_rebuild_items"("userId", "platform", "status");
