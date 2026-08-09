// Tests for post-integrity.ts — Post/currentVersion equality + typed errors.
// Run: npx tsx src/lib/__tests__/post-integrity.test.ts

import {
  assertPostMatchesCurrentVersion,
  checkPostIntegrity,
  PostIntegrityError,
} from "../post-integrity";
import type { Post, PostVersion } from "@prisma/client";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function expectThrow<T extends Error>(
  fn: () => void,
  ErrorClass: new (...args: never[]) => T,
  label: string
): void {
  try {
    fn();
    console.error(`FAIL: ${label} (expected ${ErrorClass.name} to be thrown)`);
    failures++;
  } catch (e) {
    if (e instanceof ErrorClass) {
      console.log(`PASS: ${label}`);
    } else {
      console.error(`FAIL: ${label} (threw ${(e as Error).name}, expected ${ErrorClass.name})`);
      failures++;
    }
  }
}

// ─── Fixtures ───────────────────────────────────────────────────────────────

const baseFields = {
  format: "Reel",
  title: "5 things I learned selling my first chart",
  hook: "I thought I knew the market.",
  body: "Here is the body text.",
  cta: "Reply with CHART for the guide.",
  caption: "Caption text here.",
  musicSuggestion: "lofi-beat-123",
  duration: "00:00:30",
  directions: "Open with a question.",
};

type PostFixture = Pick<Post, "id" | "currentVersionId" | keyof typeof baseFields> & Record<string, unknown>;
type VersionFixture = Pick<PostVersion, "id" | "postId" | keyof typeof baseFields> & Record<string, unknown>;

function makePost(overrides: Partial<PostFixture> = {}): PostFixture {
  return {
    id: "post_1",
    currentVersionId: "ver_1",
    ...baseFields,
    ...overrides,
  };
}

function makeVersion(overrides: Partial<VersionFixture> = {}): VersionFixture {
  return {
    id: "ver_1",
    postId: "post_1",
    ...baseFields,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

// 1. Matching post + version → no throw.
assertPostMatchesCurrentVersion(makePost(), makeVersion());
assert(true, "matching post + version does not throw");

// 2. checkPostIntegrity returns null when consistent.
assert(checkPostIntegrity(makePost(), makeVersion()) === null, "checkPostIntegrity returns null when consistent");

// 3. Missing currentVersionId → typed error.
expectThrow(
  () => assertPostMatchesCurrentVersion(makePost({ currentVersionId: null }), makeVersion()),
  PostIntegrityError,
  "null currentVersionId throws PostIntegrityError"
);

// 4. currentVersion null → typed error.
expectThrow(
  () => assertPostMatchesCurrentVersion(makePost(), null),
  PostIntegrityError,
  "null currentVersion throws PostIntegrityError"
);

// 5. Version belongs to another post → typed error VERSION_BELONGS_TO_OTHER_POST.
try {
  assertPostMatchesCurrentVersion(makePost(), makeVersion({ postId: "post_other" }));
  console.error("FAIL: version belonging to another post should throw");
  failures++;
} catch (e) {
  if (e instanceof PostIntegrityError && e.reason === "VERSION_BELONGS_TO_OTHER_POST") {
    console.log("PASS: version belonging to another post throws VERSION_BELONGS_TO_OTHER_POST");
  } else {
    console.error(`FAIL: wrong error/reason — ${(e as Error).name} ${(e as PostIntegrityError).reason ?? ""}`);
    failures++;
  }
}

// 6. Content mismatch on title → typed error CONTENT_MISMATCH.
try {
  assertPostMatchesCurrentVersion(makePost({ title: "different title" }), makeVersion());
  console.error("FAIL: title mismatch should throw");
  failures++;
} catch (e) {
  if (e instanceof PostIntegrityError && e.reason === "CONTENT_MISMATCH") {
    console.log("PASS: title mismatch throws CONTENT_MISMATCH");
  } else {
    console.error(`FAIL: wrong error/reason for title mismatch — ${(e as Error).name}`);
    failures++;
  }
}

// 7. Content mismatch on nullable field (musicSuggestion).
try {
  assertPostMatchesCurrentVersion(makePost({ musicSuggestion: null }), makeVersion({ musicSuggestion: "lofi-beat-123" }));
  console.error("FAIL: musicSuggestion mismatch should throw");
  failures++;
} catch (e) {
  if (e instanceof PostIntegrityError && e.reason === "CONTENT_MISMATCH") {
    console.log("PASS: musicSuggestion mismatch throws CONTENT_MISMATCH");
  } else {
    console.error(`FAIL: wrong error/reason for musicSuggestion mismatch — ${(e as Error).name}`);
    failures++;
  }
}

// 8. Error code is always POST_INTEGRITY.
const err = checkPostIntegrity(makePost({ currentVersionId: null }), makeVersion());
assert(err instanceof PostIntegrityError && err.code === "POST_INTEGRITY", "PostIntegrityError.code === POST_INTEGRITY");

// 9. Both null musicSuggestion → consistent (no throw).
assertPostMatchesCurrentVersion(
  makePost({ musicSuggestion: null }),
  makeVersion({ musicSuggestion: null })
);
assert(true, "both-null musicSuggestion is consistent");

// 10. version.id !== post.currentVersionId → MISSING_CURRENT_VERSION.
try {
  assertPostMatchesCurrentVersion(makePost({ currentVersionId: "ver_1" }), makeVersion({ id: "ver_other" }));
  console.error("FAIL: version id mismatch should throw");
  failures++;
} catch (e) {
  if (e instanceof PostIntegrityError && e.reason === "MISSING_CURRENT_VERSION") {
    console.log("PASS: version id mismatch throws MISSING_CURRENT_VERSION");
  } else {
    console.error(`FAIL: wrong error/reason for version id mismatch — ${(e as Error).name}`);
    failures++;
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll post-integrity tests passed.");
}
