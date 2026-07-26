-- AlterTable
ALTER TABLE "users" ADD COLUMN     "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3),
ADD COLUMN     "trialWillEndNotifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_trialEndsAt_idx" ON "users"("trialEndsAt");
