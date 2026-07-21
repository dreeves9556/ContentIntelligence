-- AlterTable
ALTER TABLE "invite_tokens" ALTER COLUMN "plan" SET DEFAULT 'CREATOR';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'CREATOR';
