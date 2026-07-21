-- CreateTable
CREATE TABLE "pending_stripe_invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "purchaseType" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "organizationName" TEXT,
    "seats" INTEGER,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripeStatus" TEXT,
    "plan" "UserPlan" NOT NULL DEFAULT 'PRO',
    "inviteRole" "UserRole" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_stripe_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_stripe_invites_token_key" ON "pending_stripe_invites"("token");

-- CreateIndex
CREATE INDEX "pending_stripe_invites_email_idx" ON "pending_stripe_invites"("email");

-- CreateIndex
CREATE INDEX "pending_stripe_invites_stripeCustomerId_idx" ON "pending_stripe_invites"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "pending_stripe_invites_stripeSubscriptionId_idx" ON "pending_stripe_invites"("stripeSubscriptionId");
