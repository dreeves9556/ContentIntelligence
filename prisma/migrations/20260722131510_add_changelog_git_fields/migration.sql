/*
  Warnings:

  - A unique constraint covering the columns `[gitSha]` on the table `changelog_entries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "changelog_entries" ADD COLUMN     "gitAuthor" TEXT,
ADD COLUMN     "gitSha" TEXT,
ADD COLUMN     "gitUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "changelog_entries_gitSha_key" ON "changelog_entries"("gitSha");
