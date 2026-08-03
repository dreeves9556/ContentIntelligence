-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('GENERATED', 'REFINED', 'APPROVED', 'SCHEDULED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PostVersionSource" AS ENUM ('GENERATION', 'AI_REFINEMENT', 'MANUAL_EDIT', 'RESTORE');

-- CreateEnum
CREATE TYPE "RefinementSessionStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "RefinementMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "RefinementInputType" AS ENUM ('QUICK_ACTION', 'FREEFORM', 'SUGGESTION', 'CONVERSATION');

-- CreateEnum
CREATE TYPE "RefinementTurnStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'ERROR');

-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "generationLogId" TEXT,
ADD COLUMN     "generationStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "model" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "weekStarting" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "day" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "musicSuggestion" TEXT,
    "duration" TEXT,
    "directions" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'GENERATED',
    "statusBeforePublished" "PostStatus",
    "provenanceJson" JSONB,
    "currentVersionId" TEXT,
    "publishedVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "externalPostId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_versions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" "PostVersionSource" NOT NULL DEFAULT 'GENERATION',
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "musicSuggestion" TEXT,
    "duration" TEXT,
    "directions" TEXT,
    "changeSummary" TEXT,
    "provenanceJson" JSONB,
    "aiModel" TEXT,
    "estimatedCostMicrodollars" INTEGER,
    "latencyMs" INTEGER,
    "restoredFromVersionId" TEXT,
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_refinement_sessions" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RefinementSessionStatus" NOT NULL DEFAULT 'OPEN',
    "baseVersionId" TEXT,
    "baseVersionNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "acceptedVersionId" TEXT,

    CONSTRAINT "post_refinement_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_refinement_turns" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "status" "RefinementTurnStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processingAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastErrorKind" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_refinement_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_refinement_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "role" "RefinementMessageRole" NOT NULL,
    "inputType" "RefinementInputType",
    "actionKey" TEXT,
    "message" TEXT NOT NULL,
    "snapshotJson" JSONB,
    "instructionLength" INTEGER,
    "timeSpentMs" INTEGER,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "latencyMs" INTEGER,
    "estimatedCostMicrodollars" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_refinement_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_currentVersionId_key" ON "posts"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "posts_publishedVersionId_key" ON "posts"("publishedVersionId");

-- CreateIndex
CREATE INDEX "posts_userId_calendarId_idx" ON "posts"("userId", "calendarId");

-- CreateIndex
CREATE INDEX "posts_userId_status_idx" ON "posts"("userId", "status");

-- CreateIndex
CREATE INDEX "posts_calendarId_status_idx" ON "posts"("calendarId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "posts_calendarId_dayIndex_key" ON "posts"("calendarId", "dayIndex");

-- CreateIndex
CREATE INDEX "post_versions_postId_createdAt_idx" ON "post_versions"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "post_versions_postId_versionNumber_key" ON "post_versions"("postId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "post_refinement_sessions_acceptedVersionId_key" ON "post_refinement_sessions"("acceptedVersionId");

-- CreateIndex
CREATE INDEX "post_refinement_sessions_postId_startedAt_idx" ON "post_refinement_sessions"("postId", "startedAt");

-- CreateIndex
CREATE INDEX "post_refinement_sessions_userId_startedAt_idx" ON "post_refinement_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "post_refinement_sessions_postId_status_idx" ON "post_refinement_sessions"("postId", "status");

-- CreateIndex
CREATE INDEX "post_refinement_sessions_status_lastActivityAt_idx" ON "post_refinement_sessions"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "post_refinement_turns_sessionId_status_idx" ON "post_refinement_turns"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "post_refinement_turns_sessionId_turnId_key" ON "post_refinement_turns"("sessionId", "turnId");

-- CreateIndex
CREATE INDEX "post_refinement_messages_sessionId_turnId_createdAt_idx" ON "post_refinement_messages"("sessionId", "turnId", "createdAt");

-- CreateIndex
CREATE INDEX "post_refinement_messages_sessionId_createdAt_idx" ON "post_refinement_messages"("sessionId", "createdAt");

-- CreateIndex (partial — at most one OPEN refinement session per post; Prisma does not support partial unique indexes natively)
CREATE UNIQUE INDEX "post_refinement_sessions_one_open_per_post"
ON "post_refinement_sessions" ("postId")
WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_generationLogId_fkey" FOREIGN KEY ("generationLogId") REFERENCES "calendar_generation_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_restoredFromVersionId_fkey" FOREIGN KEY ("restoredFromVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_versions" ADD CONSTRAINT "post_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_sessions" ADD CONSTRAINT "post_refinement_sessions_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_sessions" ADD CONSTRAINT "post_refinement_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_sessions" ADD CONSTRAINT "post_refinement_sessions_acceptedVersionId_fkey" FOREIGN KEY ("acceptedVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_sessions" ADD CONSTRAINT "post_refinement_sessions_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "post_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_turns" ADD CONSTRAINT "post_refinement_turns_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "post_refinement_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_refinement_messages" ADD CONSTRAINT "post_refinement_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "post_refinement_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
