-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postingReminder" BOOLEAN NOT NULL DEFAULT true,
    "postPublished" BOOLEAN NOT NULL DEFAULT true,
    "postFailed" BOOLEAN NOT NULL DEFAULT true,
    "newComment" BOOLEAN NOT NULL DEFAULT true,
    "analyticsMilestone" BOOLEAN NOT NULL DEFAULT true,
    "streakWarning" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "accountDisconnected" BOOLEAN NOT NULL DEFAULT true,
    "adminBroadcast" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
