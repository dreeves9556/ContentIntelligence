-- AlterTable
ALTER TABLE "zernio_accounts" ADD COLUMN     "lastSyncAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "platform_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "zernioApiKey" TEXT,
    "zernioEnabledPlatforms" TEXT[] DEFAULT ARRAY['instagram', 'tiktok', 'facebook', 'youtube']::TEXT[],
    "analyticsSyncFrequencyMinutes" INTEGER NOT NULL DEFAULT 60,
    "anthropicModel" TEXT NOT NULL DEFAULT 'claude-opus-4-8',
    "anthropicApiKey" TEXT,
    "insightPromptTemplate" TEXT,
    "calendarPromptTemplate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("id")
);
