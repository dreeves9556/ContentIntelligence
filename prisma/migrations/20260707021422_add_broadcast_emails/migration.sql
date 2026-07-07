-- CreateTable
CREATE TABLE "broadcast_emails" (
    "id" TEXT NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "resendId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "broadcast_emails_broadcastId_idx" ON "broadcast_emails"("broadcastId");

-- CreateIndex
CREATE INDEX "broadcast_emails_resendId_idx" ON "broadcast_emails"("resendId");

-- AddForeignKey
ALTER TABLE "broadcast_emails" ADD CONSTRAINT "broadcast_emails_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "scheduled_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
