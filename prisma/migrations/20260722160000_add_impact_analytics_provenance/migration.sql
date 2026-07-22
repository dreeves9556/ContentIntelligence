-- Add explicit provenance so sample rows and cross-platform posts cannot enter impact metrics.
ALTER TABLE "post_analytics"
ADD COLUMN "platform" TEXT,
ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- Existing synced rows stored the platform in `format`.
UPDATE "post_analytics"
SET "platform" = LOWER("format")
WHERE UPPER("format") IN ('INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'YOUTUBE', 'LINKEDIN');

-- Quarantine the seven built-in sample rows using their complete known fingerprint.
UPDATE "post_analytics"
SET "isDemo" = true
WHERE ("title", "format", "publishedAt", "views", "likes", "comments") IN (
  ('How to Build Your Personal Brand in 2025', 'REEL', TIMESTAMP '2025-06-15 00:00:00', 12500, 980, 145),
  ('5 Tips for Local Business Marketing', 'CAROUSEL', TIMESTAMP '2025-06-12 00:00:00', 8900, 620, 87),
  ('Behind the Scenes: Our Creative Process', 'REEL', TIMESTAMP '2025-06-10 00:00:00', 15200, 1450, 203),
  ('Expert Advice: Industry Trends to Watch', 'STATIC', TIMESTAMP '2025-06-08 00:00:00', 6700, 410, 62),
  ('Customer Success Story: Local Cafe Rebrand', 'CAROUSEL', TIMESTAMP '2025-06-05 00:00:00', 9800, 870, 134),
  ('Product Launch: What''s New This Month', 'REEL', TIMESTAMP '2025-06-03 00:00:00', 18300, 1720, 298),
  ('Community Spotlight: Local Artists', 'STATIC', TIMESTAMP '2025-06-01 00:00:00', 5400, 380, 51)
);

CREATE INDEX "post_analytics_userId_platform_publishedAt_idx"
ON "post_analytics"("userId", "platform", "publishedAt");

CREATE INDEX "post_analytics_isDemo_idx"
ON "post_analytics"("isDemo");
