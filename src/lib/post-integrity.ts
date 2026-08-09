import type { Post, PostVersion } from "@prisma/client";

/**
 * Typed data-integrity error raised when a Post's current-version pointer is
 * missing or points to a version belonging to a different Post.
 */
export class PostIntegrityError extends Error {
  readonly code = "POST_INTEGRITY";
  readonly postId: string;
  readonly currentVersionId: string | null;
  readonly reason: "MISSING_CURRENT_VERSION" | "VERSION_BELONGS_TO_OTHER_POST" | "CONTENT_MISMATCH";

  constructor(
    postId: string,
    currentVersionId: string | null,
    reason: PostIntegrityError["reason"],
    detail?: string
  ) {
    super(`Post integrity error for ${postId}: ${reason}${detail ? ` — ${detail}` : ""}`);
    this.name = "PostIntegrityError";
    this.postId = postId;
    this.currentVersionId = currentVersionId;
    this.reason = reason;
  }
}

const CONTENT_FIELDS = [
  "format",
  "title",
  "hook",
  "body",
  "cta",
  "caption",
  "musicSuggestion",
  "duration",
  "directions",
] as const;

type ContentField = (typeof CONTENT_FIELDS)[number];

type PostForIntegrity = Pick<Post, "id" | "currentVersionId" | ContentField>;
type VersionForIntegrity = Pick<PostVersion, "id" | "postId" | ContentField>;

/**
 * Assert that a Post's denormalized content fields exactly equal the snapshot
 * referenced by Post.currentVersionId, and that the pointer is valid.
 *
 * Post fields are the canonical current state and the canonical display
 * source. PostVersion referenced by currentVersionId is the immutable matching
 * snapshot, used for version metadata only. If they ever diverge, the data
 * model is corrupt and the operation must abort.
 */
export function assertPostMatchesCurrentVersion(
  post: PostForIntegrity,
  currentVersion: VersionForIntegrity | null
): void {
  if (!post.currentVersionId) {
    throw new PostIntegrityError(post.id, null, "MISSING_CURRENT_VERSION");
  }

  if (!currentVersion) {
    throw new PostIntegrityError(post.id, post.currentVersionId, "MISSING_CURRENT_VERSION");
  }

  if (currentVersion.id !== post.currentVersionId) {
    throw new PostIntegrityError(
      post.id,
      post.currentVersionId,
      "MISSING_CURRENT_VERSION",
      `currentVersionId ${post.currentVersionId} does not match loaded version ${currentVersion.id}`
    );
  }

  if (currentVersion.postId !== post.id) {
    throw new PostIntegrityError(
      post.id,
      post.currentVersionId,
      "VERSION_BELONGS_TO_OTHER_POST",
      `version ${currentVersion.id} belongs to post ${currentVersion.postId}`
    );
  }

  for (const field of CONTENT_FIELDS) {
    const postValue = post[field];
    const versionValue = currentVersion[field];
    if (postValue !== versionValue) {
      throw new PostIntegrityError(
        post.id,
        post.currentVersionId,
        "CONTENT_MISMATCH",
        `field "${field}" differs: post=${JSON.stringify(postValue)} version=${JSON.stringify(versionValue)}`
      );
    }
  }
}

/**
 * Non-throwing variant for use in tests / diagnostics. Returns the first
 * mismatch reason, or null if the post is consistent.
 */
export function checkPostIntegrity(
  post: PostForIntegrity,
  currentVersion: VersionForIntegrity | null
): PostIntegrityError | null {
  try {
    assertPostMatchesCurrentVersion(post, currentVersion);
    return null;
  } catch (e) {
    if (e instanceof PostIntegrityError) return e;
    throw e;
  }
}
