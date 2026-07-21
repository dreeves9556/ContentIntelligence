/*
  Sunsetting CREATOR plan (migrate to PRO) and renaming LOCKED → ARCHIVED.

  Uses CASE expressions during type cast to migrate values inline,
  avoiding the need for ALTER TYPE ADD VALUE (which can't be used
  in the same transaction as the UPDATE).
*/

-- Step 1: Replace AccountStatus enum (LOCKED → ARCHIVED during cast)
BEGIN;
CREATE TYPE "AccountStatus_new" AS ENUM ('ACTIVE', 'TRIAL', 'COMPED', 'EXPIRED', 'PAST_DUE', 'CANCELED', 'ARCHIVED');
ALTER TABLE "users" ALTER COLUMN "accountStatus" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "accountStatus" TYPE "AccountStatus_new" USING (
  CASE "accountStatus"::text
    WHEN 'LOCKED' THEN 'ARCHIVED'
    ELSE "accountStatus"::text
  END
)::"AccountStatus_new";
ALTER TYPE "AccountStatus" RENAME TO "AccountStatus_old";
ALTER TYPE "AccountStatus_new" RENAME TO "AccountStatus";
DROP TYPE "AccountStatus_old";
ALTER TABLE "users" ALTER COLUMN "accountStatus" SET DEFAULT 'ACTIVE';
COMMIT;

-- Step 2: Replace UserPlan enum (CREATOR → PRO during cast)
BEGIN;
CREATE TYPE "UserPlan_new" AS ENUM ('CALENDAR_ONLY', 'PRO');
ALTER TABLE "invite_tokens" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "organizations" ALTER COLUMN "seatPlan" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "plan" TYPE "UserPlan_new" USING (
  CASE "plan"::text
    WHEN 'CREATOR' THEN 'PRO'
    ELSE "plan"::text
  END
)::"UserPlan_new";
ALTER TABLE "invite_tokens" ALTER COLUMN "plan" TYPE "UserPlan_new" USING (
  CASE "plan"::text
    WHEN 'CREATOR' THEN 'PRO'
    ELSE "plan"::text
  END
)::"UserPlan_new";
ALTER TABLE "organizations" ALTER COLUMN "seatPlan" TYPE "UserPlan_new" USING (
  CASE "seatPlan"::text
    WHEN 'CREATOR' THEN 'PRO'
    ELSE "seatPlan"::text
  END
)::"UserPlan_new";
ALTER TYPE "UserPlan" RENAME TO "UserPlan_old";
ALTER TYPE "UserPlan_new" RENAME TO "UserPlan";
DROP TYPE "UserPlan_old";
ALTER TABLE "invite_tokens" ALTER COLUMN "plan" SET DEFAULT 'PRO';
ALTER TABLE "organizations" ALTER COLUMN "seatPlan" SET DEFAULT 'CALENDAR_ONLY';
ALTER TABLE "users" ALTER COLUMN "plan" SET DEFAULT 'PRO';
COMMIT;
