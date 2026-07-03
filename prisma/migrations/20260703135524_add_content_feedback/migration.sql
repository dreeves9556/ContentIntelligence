-- CreateTable
CREATE TABLE "content_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStarting" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_feedback_userId_weekStarting_dayIndex_key" ON "content_feedback"("userId", "weekStarting", "dayIndex");

-- AddForeignKey
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
