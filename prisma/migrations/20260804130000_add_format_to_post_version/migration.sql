-- Add format column to PostVersion to preserve the original format of each
-- version. Previously PostVersion did not store format, so history displayed
-- every version using the post's CURRENT format, and restoring an older
-- version did not restore its original format.
--
-- The column is nullable. Existing rows are left NULL (not backfilled) because
-- the historical format at the time of version creation was never recorded —
-- backfilling with the post's CURRENT format would be misleading (a version
-- created as a REEL would show as CAROUSEL if the post's format later changed).
--
-- The read path (versionToFields in post-refinement/actions.ts) falls back to
-- the post's current format when version.format is NULL, so existing versions
-- continue to display correctly. New versions always capture the real format.
--
-- Restoring an old (pre-migration) version will use the post's current format
-- as fallback — this is the best available behavior since the original format
-- was never stored.

ALTER TABLE "post_versions" ADD COLUMN "format" TEXT;
