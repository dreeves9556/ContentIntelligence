-- CreateEnum
CREATE TYPE "UserPlan" AS ENUM ('CALENDAR_ONLY', 'CREATOR', 'PRO');

-- AlterTable
ALTER TABLE "platform_config" ADD COLUMN     "calendarStrategyPromptTemplate" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "plan" "UserPlan" NOT NULL DEFAULT 'CREATOR';
