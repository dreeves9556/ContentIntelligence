-- AlterTable
ALTER TABLE "pending_stripe_invites" ADD COLUMN     "emailSentAt" TIMESTAMP(3),
ADD COLUMN     "lastEmailError" TEXT;
