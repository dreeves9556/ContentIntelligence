-- AlterTable
ALTER TABLE "platform_config" ADD COLUMN     "adminNotifyEmail" TEXT,
ADD COLUMN     "notifyOnSignup" BOOLEAN NOT NULL DEFAULT false;
