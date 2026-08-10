-- Migration A — Listings foundation (V1A)
-- Adds Listing, ListingContent, ListingContentVersion, ListingLibraryItem, ListingGenerationRequest.
-- No existing table or constraint is removed. RefinableContentKind is deferred to Migration B.

-- CreateEnum
CREATE TYPE "ListingSourceType" AS ENUM ('MANUAL', 'URL_IMPORT');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ListingContentIntent" AS ENUM ('COMING_SOON', 'JUST_LISTED', 'OPEN_HOUSE', 'PRICE_IMPROVEMENT', 'PROPERTY_SPOTLIGHT', 'UNDER_CONTRACT', 'JUST_SOLD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ListingAssetType" AS ENUM ('SOCIAL_CAPTION');

-- CreateEnum
CREATE TYPE "ListingContentStatus" AS ENUM ('GENERATED', 'REFINED', 'APPROVED');

-- CreateEnum
CREATE TYPE "ListingContentVersionSource" AS ENUM ('GENERATION', 'AI_REFINEMENT', 'MANUAL_EDIT', 'RESTORE');

-- CreateEnum
CREATE TYPE "ListingComplianceStatus" AS ENUM ('CLEAN', 'WARNING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ListingGenerationRequestStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "listings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceType" "ListingSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceUrl" TEXT,
    "normalizedSourceUrl" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "normalizedAddress" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "factsJson" JSONB NOT NULL,
    "insightsJson" JSONB NOT NULL DEFAULT '{}',
    "extractedFactsJson" JSONB,
    "extractionMeta" JSONB,
    "factsRevision" INTEGER NOT NULL DEFAULT 0,
    "factsConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_contents" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intent" "ListingContentIntent" NOT NULL,
    "intentDataJson" JSONB NOT NULL DEFAULT '{}',
    "assetType" "ListingAssetType" NOT NULL DEFAULT 'SOCIAL_CAPTION',
    "platform" TEXT NOT NULL DEFAULT 'GENERIC',
    "status" "ListingContentStatus" NOT NULL DEFAULT 'GENERATED',
    "title" TEXT NOT NULL DEFAULT '',
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "cta" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "musicSuggestion" TEXT,
    "duration" TEXT,
    "directions" TEXT,
    "currentVersionId" TEXT,
    "approvedVersionId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_content_versions" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "source" "ListingContentVersionSource" NOT NULL DEFAULT 'GENERATION',
    "title" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "musicSuggestion" TEXT,
    "duration" TEXT,
    "directions" TEXT,
    "changeSummary" TEXT,
    "factsRevision" INTEGER NOT NULL,
    "factsSnapshotJson" JSONB NOT NULL,
    "insightsSnapshotJson" JSONB NOT NULL,
    "intentDataSnapshotJson" JSONB NOT NULL,
    "provenanceJson" JSONB,
    "complianceStatus" "ListingComplianceStatus" NOT NULL,
    "complianceIssuesJson" JSONB,
    "aiModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "estimatedCostMicrodollars" INTEGER,
    "latencyMs" INTEGER,
    "previousVersionId" TEXT,
    "restoredFromVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_library_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listing_library_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_generation_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "intent" "ListingContentIntent" NOT NULL,
    "requestParamsHash" TEXT NOT NULL,
    "status" "ListingGenerationRequestStatus" NOT NULL DEFAULT 'PROCESSING',
    "claimToken" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "errorKind" TEXT,
    "errorMessage" TEXT,
    "resultingContentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_generation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_userId_status_updatedAt_idx" ON "listings"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "listings_userId_normalizedAddress_idx" ON "listings"("userId", "normalizedAddress");

-- CreateIndex
CREATE INDEX "listings_userId_normalizedSourceUrl_idx" ON "listings"("userId", "normalizedSourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "listings_id_userId_key" ON "listings"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_contents_currentVersionId_key" ON "listing_contents"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_contents_approvedVersionId_key" ON "listing_contents"("approvedVersionId");

-- CreateIndex
CREATE INDEX "listing_contents_listingId_createdAt_idx" ON "listing_contents"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "listing_contents_userId_status_updatedAt_idx" ON "listing_contents"("userId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_contents_id_userId_key" ON "listing_contents"("id", "userId");

-- CreateIndex
CREATE INDEX "listing_content_versions_contentId_createdAt_idx" ON "listing_content_versions"("contentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_content_versions_id_contentId_key" ON "listing_content_versions"("id", "contentId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_content_versions_contentId_versionNumber_key" ON "listing_content_versions"("contentId", "versionNumber");

-- CreateIndex
CREATE INDEX "listing_library_items_userId_savedAt_idx" ON "listing_library_items"("userId", "savedAt");

-- CreateIndex
CREATE INDEX "listing_library_items_listingId_savedAt_idx" ON "listing_library_items"("listingId", "savedAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_library_items_contentId_versionId_key" ON "listing_library_items"("contentId", "versionId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_generation_requests_resultingContentId_key" ON "listing_generation_requests"("resultingContentId");

-- CreateIndex
CREATE INDEX "listing_generation_requests_status_claimedAt_idx" ON "listing_generation_requests"("status", "claimedAt");

-- CreateIndex
CREATE INDEX "listing_generation_requests_listingId_createdAt_idx" ON "listing_generation_requests"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "listing_generation_requests_userId_requestId_key" ON "listing_generation_requests"("userId", "requestId");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_contents" ADD CONSTRAINT "listing_contents_listingId_userId_fkey" FOREIGN KEY ("listingId", "userId") REFERENCES "listings"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_contents" ADD CONSTRAINT "listing_contents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_contents" ADD CONSTRAINT "listing_contents_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "listing_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_contents" ADD CONSTRAINT "listing_contents_approvedVersionId_fkey" FOREIGN KEY ("approvedVersionId") REFERENCES "listing_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "listing_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "listing_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_content_versions" ADD CONSTRAINT "listing_content_versions_restoredFromVersionId_fkey" FOREIGN KEY ("restoredFromVersionId") REFERENCES "listing_content_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_library_items" ADD CONSTRAINT "listing_library_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_library_items" ADD CONSTRAINT "listing_library_items_listingId_userId_fkey" FOREIGN KEY ("listingId", "userId") REFERENCES "listings"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_library_items" ADD CONSTRAINT "listing_library_items_contentId_userId_fkey" FOREIGN KEY ("contentId", "userId") REFERENCES "listing_contents"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_library_items" ADD CONSTRAINT "listing_library_items_versionId_contentId_fkey" FOREIGN KEY ("versionId", "contentId") REFERENCES "listing_content_versions"("id", "contentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_generation_requests" ADD CONSTRAINT "listing_generation_requests_listingId_userId_fkey" FOREIGN KEY ("listingId", "userId") REFERENCES "listings"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_generation_requests" ADD CONSTRAINT "listing_generation_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_generation_requests" ADD CONSTRAINT "listing_generation_requests_resultingContentId_fkey" FOREIGN KEY ("resultingContentId") REFERENCES "listing_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
