-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TEAM_ADMIN';

-- AlterTable
ALTER TABLE "invite_tokens" ADD COLUMN     "inviteRole" "UserRole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "inviteSource" TEXT,
ADD COLUMN     "invitedByUserId" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "organizationId" TEXT;

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "seatLimit" INTEGER NOT NULL DEFAULT 1,
    "seatPlan" "UserPlan" NOT NULL DEFAULT 'CALENDAR_ONLY',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "stripeStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_stripeCustomerId_idx" ON "organizations"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "organizations_stripeSubscriptionId_idx" ON "organizations"("stripeSubscriptionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
