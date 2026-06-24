-- AlterTable
ALTER TABLE "invite_tokens" ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'CREATOR';
