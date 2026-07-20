-- CreateTable
CREATE TABLE "calendar_generation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "daysGenerated" INTEGER,
    "freshnessScore" INTEGER,
    "archetypeDiversity" DOUBLE PRECISION,
    "themeDiversity" DOUBLE PRECISION,
    "hookSimilarity" DOUBLE PRECISION,
    "stalenessTriggered" BOOLEAN NOT NULL DEFAULT false,
    "audienceFatigueTriggered" BOOLEAN NOT NULL DEFAULT false,
    "dynamicConstraintsMode" TEXT,
    "dynamicConstraintsFallback" BOOLEAN NOT NULL DEFAULT false,
    "blockMetadata" JSONB,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendar_generation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_generation_logs_userId_createdAt_idx" ON "calendar_generation_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "calendar_generation_logs" ADD CONSTRAINT "calendar_generation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
