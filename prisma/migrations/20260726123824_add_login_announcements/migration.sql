-- CreateTable
CREATE TABLE "login_announcements" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'all',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "login_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_announcement_dismissals" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_announcement_dismissals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "login_announcements_isActive_idx" ON "login_announcements"("isActive");

-- CreateIndex
CREATE INDEX "login_announcement_dismissals_userId_idx" ON "login_announcement_dismissals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "login_announcement_dismissals_announcementId_userId_key" ON "login_announcement_dismissals"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "login_announcement_dismissals" ADD CONSTRAINT "login_announcement_dismissals_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "login_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_announcement_dismissals" ADD CONSTRAINT "login_announcement_dismissals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
