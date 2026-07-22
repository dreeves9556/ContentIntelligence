-- CreateEnum
CREATE TYPE "ChangelogType" AS ENUM ('FEATURE', 'IMPROVEMENT', 'BUGFIX', 'SECURITY', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "changelog_entries" (
    "id" TEXT NOT NULL,
    "version" TEXT,
    "title" TEXT NOT NULL,
    "type" "ChangelogType" NOT NULL DEFAULT 'FEATURE',
    "content" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "changelog_entries_published_publishedAt_idx" ON "changelog_entries"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "changelog_entries_version_idx" ON "changelog_entries"("version");
