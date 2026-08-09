-- Make ScheduledPushNotification.createdBy nullable so that ON DELETE SET NULL
-- can actually set it to NULL when a user is deleted. Previously the column was
-- TEXT NOT NULL with a SET NULL foreign key, which caused PostgreSQL to raise
-- a constraint violation on user deletion — blocking admins who created
-- scheduled pushes from being deleted.

ALTER TABLE "scheduled_push_notifications" ALTER COLUMN "createdBy" DROP NOT NULL;
