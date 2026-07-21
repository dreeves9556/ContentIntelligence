-- CreateTable
CREATE TABLE "member_growth_baselines" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "baselineDate" TIMESTAMP(3) NOT NULL,
    "baselineFollowerCount" INTEGER,
    "baselineEngagementRate" DOUBLE PRECISION,
    "baselineAvgViews" DOUBLE PRECISION,
    "baselineAvgInteractions" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_growth_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "member_growth_baselines_platform_idx" ON "member_growth_baselines"("platform");

-- CreateIndex
CREATE INDEX "member_growth_baselines_baselineDate_idx" ON "member_growth_baselines"("baselineDate");

-- CreateIndex
CREATE UNIQUE INDEX "member_growth_baselines_userId_platform_key" ON "member_growth_baselines"("userId", "platform");

-- AddForeignKey
ALTER TABLE "member_growth_baselines" ADD CONSTRAINT "member_growth_baselines_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
