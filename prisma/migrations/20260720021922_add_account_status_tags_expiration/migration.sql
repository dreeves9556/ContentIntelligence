-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'TRIAL', 'COMPED', 'EXPIRED', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ExpirationAction" AS ENUM ('NONE', 'DOWNGRADE_TO_CALENDAR_ONLY', 'DISABLE_ACCESS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accessExpiresAt" TIMESTAMP(3),
ADD COLUMN     "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "compReason" TEXT,
ADD COLUMN     "expirationAction" "ExpirationAction" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "internalTag" TEXT,
ADD COLUMN     "isComped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastAccessCheckAt" TIMESTAMP(3),
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeStatus" TEXT,
ADD COLUMN     "stripeSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "users_internalTag_idx" ON "users"("internalTag");

-- CreateIndex
CREATE INDEX "users_accountStatus_idx" ON "users"("accountStatus");

-- CreateIndex
CREATE INDEX "users_accessExpiresAt_idx" ON "users"("accessExpiresAt");

-- CreateIndex
CREATE INDEX "users_stripeCustomerId_idx" ON "users"("stripeCustomerId");
