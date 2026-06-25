-- CreateTable
CREATE TABLE "best_time_to_post" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "heatmap" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "best_time_to_post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "best_time_to_post_userId_platform_key" ON "best_time_to_post"("userId", "platform");

-- AddForeignKey
ALTER TABLE "best_time_to_post" ADD CONSTRAINT "best_time_to_post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
