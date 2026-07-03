-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('IDENTITY', 'VOICE', 'AUDIENCE', 'CONTENT', 'PERFORMANCE', 'STRATEGY', 'PREFERENCE', 'WARNING');

-- CreateEnum
CREATE TYPE "Importance" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "MemorySource" AS ENUM ('QUESTIONNAIRE', 'PROFILE_SURVEY', 'ANALYTICS', 'CONTENT_FEEDBACK', 'AI_GENERATED', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "creator_memories" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryType" "MemoryType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "importance" "Importance" NOT NULL DEFAULT 'MEDIUM',
    "source" "MemorySource" NOT NULL DEFAULT 'SYSTEM',
    "metadata" JSONB,
    "embedding" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "creator_memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "creator_memories_userId_memoryType_idx" ON "creator_memories"("userId", "memoryType");

-- CreateIndex
CREATE INDEX "creator_memories_userId_importance_idx" ON "creator_memories"("userId", "importance");

-- AddForeignKey
ALTER TABLE "creator_memories" ADD CONSTRAINT "creator_memories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
