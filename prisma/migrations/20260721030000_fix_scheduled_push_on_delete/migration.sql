-- AlterTable
-- Change "ScheduledPushCreator" foreign key to SET NULL on delete
-- Previously defaulted to RESTRICT, which blocked user deletion when push notifications existed

ALTER TABLE "scheduled_push_notifications" DROP CONSTRAINT "scheduled_push_notifications_createdBy_fkey";

ALTER TABLE "scheduled_push_notifications" ADD CONSTRAINT "scheduled_push_notifications_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
