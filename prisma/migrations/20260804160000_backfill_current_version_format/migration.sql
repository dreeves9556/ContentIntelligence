-- Backfill PostVersion.format for versions currently referenced as a Post's
-- current version.
--
-- Migration 20260804130000 added PostVersion.format as a nullable column and
-- left every existing version with format = NULL. The integrity check
-- assertPostMatchesCurrentVersion() compares Post.format to the current
-- version's format. With NULL formats, every pre-migration post threw
-- CONTENT_MISMATCH before refinement acceptance or restoration.
--
-- This migration backfills format ONLY for the version each Post currently
-- points to (Post.currentVersionId). For the current version, the post's
-- denormalized format IS the correct format — the current version's content
-- always mirrors the post's content. Historical versions whose original
-- format was never recorded remain NULL (unknowable), which the read path
-- (versionToFields) and the integrity check interpret as the post's current
-- format.
--
-- Safe because:
-- - Only rows referenced by posts.currentVersionId are touched.
-- - Only NULL formats are set (COALESCE preserves any already-recorded format).
-- - The value is copied from the owning post's format, which is the canonical
--   current state.
-- - Historical versions are left NULL.

UPDATE "post_versions"
SET "format" = "posts"."format"
FROM "posts"
WHERE "posts"."currentVersionId" = "post_versions"."id"
  AND "post_versions"."format" IS NULL;
