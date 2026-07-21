-- CreateTable
CREATE TABLE "value_call_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "title" TEXT NOT NULL DEFAULT 'Next Value Call',
    "description" TEXT,
    "callStartsAt" TIMESTAMP(3),
    "zoomUrl" TEXT,
    "timezone" TEXT DEFAULT 'America/New_York',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "value_call_settings_pkey" PRIMARY KEY ("id")
);
