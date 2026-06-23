/*
  Warnings:

  - A unique constraint covering the columns `[externalId,userId]` on the table `post_analytics` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "post_analytics_externalId_userId_key" ON "post_analytics"("externalId", "userId");
