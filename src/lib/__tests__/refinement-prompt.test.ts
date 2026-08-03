// Tests for refinement-prompt.ts — parser, length limits, summarizer, quick-actions.
// Run: npx tsx src/lib/__tests__/refinement-prompt.test.ts

import {
  parseRefinementResponse,
  parseStoredSnapshot,
  UserInstructionSchema,
  TurnIdSchema,
  summarizeOlderTurns,
  quickActionInstruction,
  QUICK_ACTIONS,
  buildRefinementUserPrompt,
  REFINEMENT_SYSTEM_PROMPT,
  MAX_TURNS_BEFORE_SUMMARY,
  type ConversationTurn,
} from "../refinement-prompt";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const validSnapshot = {
  title: "5 things I learned",
  hook: "I thought I knew the market.",
  body: "Here is the body.",
  cta: "Reply CHART for the guide.",
  caption: "Caption text.",
  format: "Reel",
  changeSummary: "- Shortened the hook\n- Redirected CTA to the chart guide",
};

// ─── Parser ──────────────────────────────────────────────────────────────────

// 1. Valid JSON parses.
const r1 = parseRefinementResponse(JSON.stringify(validSnapshot));
assert(r1.ok === true, "valid JSON snapshot parses");

// 2. JSON wrapped in ```json fences parses.
const fenced = "```json\n" + JSON.stringify(validSnapshot) + "\n```";
const r2 = parseRefinementResponse(fenced);
assert(r2.ok === true, "fenced JSON snapshot parses");

// 2b. JSON with AI preamble before the object parses (fallback extraction).
const withPreamble = "Here is the revised post:\n" + JSON.stringify(validSnapshot);
const r2b = parseRefinementResponse(withPreamble);
assert(r2b.ok === true, "JSON with preamble parses via fallback extraction");

// 3. Non-JSON → PARSE_ERROR.
const r3 = parseRefinementResponse("not json at all");
assert(r3.ok === false && r3.errorKind === "PARSE_ERROR", "non-JSON returns PARSE_ERROR");

// 4. JSON missing changeSummary → SCHEMA_INVALID.
const r4 = parseRefinementResponse(JSON.stringify({ ...validSnapshot, changeSummary: undefined }));
assert(r4.ok === false && r4.errorKind === "SCHEMA_INVALID", "missing changeSummary returns SCHEMA_INVALID");

// ─── Length limits (correction #7) ───────────────────────────────────────────

// 5. Body over 3000 chars → SCHEMA_INVALID.
const longBody = { ...validSnapshot, body: "x".repeat(3001) };
const r5 = parseRefinementResponse(JSON.stringify(longBody));
assert(r5.ok === false && r5.errorKind === "SCHEMA_INVALID", "body > 3000 chars rejected");

// 6. Caption over 2200 chars → SCHEMA_INVALID.
const longCaption = { ...validSnapshot, caption: "x".repeat(2201) };
const r6 = parseRefinementResponse(JSON.stringify(longCaption));
assert(r6.ok === false && r6.errorKind === "SCHEMA_INVALID", "caption > 2200 chars rejected");

// 7. Title over 200 chars → SCHEMA_INVALID.
const longTitle = { ...validSnapshot, title: "x".repeat(201) };
const r7 = parseRefinementResponse(JSON.stringify(longTitle));
assert(r7.ok === false && r7.errorKind === "SCHEMA_INVALID", "title > 200 chars rejected");

// 8. changeSummary over 1000 chars → SCHEMA_INVALID.
const longSummary = { ...validSnapshot, changeSummary: "x".repeat(1001) };
const r8 = parseRefinementResponse(JSON.stringify(longSummary));
assert(r8.ok === false && r8.errorKind === "SCHEMA_INVALID", "changeSummary > 1000 chars rejected");

// 9. Body exactly 3000 chars → valid.
const maxBody = { ...validSnapshot, body: "x".repeat(3000) };
const r9 = parseRefinementResponse(JSON.stringify(maxBody));
assert(r9.ok === true, "body exactly 3000 chars accepted");

// ─── UserInstructionSchema ───────────────────────────────────────────────────

// 10. Instruction over 1000 chars → invalid.
assert(UserInstructionSchema.safeParse("x".repeat(1001)).success === false, "user instruction > 1000 chars rejected");

// 11. Empty instruction → invalid.
assert(UserInstructionSchema.safeParse("").success === false, "empty user instruction rejected");

// 12. Instruction exactly 1000 chars → valid.
assert(UserInstructionSchema.safeParse("x".repeat(1000)).success === true, "user instruction exactly 1000 chars accepted");

// ─── TurnIdSchema (correction #6) ────────────────────────────────────────────

// 13. Valid UUID accepted.
assert(TurnIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success === true, "valid UUID turnId accepted");

// 14. Non-UUID rejected.
assert(TurnIdSchema.safeParse("not-a-uuid").success === false, "non-UUID turnId rejected");

// 15. Empty turnId rejected.
assert(TurnIdSchema.safeParse("").success === false, "empty turnId rejected");

// ─── Summarizer ──────────────────────────────────────────────────────────────

// 16. Empty turns → empty string.
assert(summarizeOlderTurns([]) === "", "empty turns → empty summary");

// 17. Turns produce a summary with prior_turns_summary tags.
const turns: ConversationTurn[] = [
  { role: "USER", message: "Make the CTA stronger" },
  { role: "ASSISTANT", message: "Shortened hook, redirected CTA", snapshot: null },
];
const summary = summarizeOlderTurns(turns);
assert(summary.includes("<prior_turns_summary>"), "summary wrapped in prior_turns_summary tag");
assert(summary.includes("Turn 1"), "summary includes Turn 1");
assert(summary.includes("Turn 2"), "summary includes Turn 2");

// 18. Long USER instruction truncated to 120 chars in summary.
const longInstructionTurn: ConversationTurn[] = [
  { role: "USER", message: "x".repeat(200), snapshot: null },
];
const longSummary2 = summarizeOlderTurns(longInstructionTurn);
assert(longSummary2.includes("..."), "long instruction truncated with ellipsis in summary");

// ─── Quick actions ───────────────────────────────────────────────────────────

// 19. Known actionKey returns instruction.
assert(quickActionInstruction("stronger_cta") !== null, "known actionKey returns instruction");

// 20. Unknown actionKey returns null.
assert(quickActionInstruction("nonexistent") === null, "unknown actionKey returns null");

// 21. QUICK_ACTIONS has the 5 presets.
assert(QUICK_ACTIONS.length === 5, "5 quick-action presets defined");

// ─── Prompt builder ──────────────────────────────────────────────────────────

// 22. buildRefinementUserPrompt includes original_post, working_draft, instruction.
const prompt = buildRefinementUserPrompt({
  original: { title: "t", hook: "h", body: "b", cta: "c", caption: "cap", format: "Static", musicSuggestion: null, duration: null, directions: null },
  workingDraft: { title: "t2", hook: "h2", body: "b2", cta: "c2", caption: "cap2", format: "Static", musicSuggestion: null, duration: null, directions: null },
  recentTurns: [],
  olderTurns: [],
  instruction: "Make it shorter",
  userProfileXml: "",
  memoriesXml: "",
});
assert(prompt.includes("<original_post>"), "prompt includes original_post block");
assert(prompt.includes("<working_draft>"), "prompt includes working_draft block");
assert(prompt.includes("<user_instruction>"), "prompt includes user_instruction block");

// 23. System prompt mentions JSON shape.
assert(REFINEMENT_SYSTEM_PROMPT.includes("JSON"), "system prompt mentions JSON");

// 24. MAX_TURNS_BEFORE_SUMMARY is 6.
assert(MAX_TURNS_BEFORE_SUMMARY === 6, "MAX_TURNS_BEFORE_SUMMARY === 6");

// ─── Format enum + legacy backfill ───────────────────────────────────────────

// 25. format missing entirely → SCHEMA_INVALID.
const noFormat = { ...validSnapshot, format: undefined };
const r25 = parseRefinementResponse(JSON.stringify(noFormat));
assert(r25.ok === false && r25.errorKind === "SCHEMA_INVALID", "missing format rejected");

// 26. format not in enum → SCHEMA_INVALID.
const badFormat = { ...validSnapshot, format: "Story" };
const r26 = parseRefinementResponse(JSON.stringify(badFormat));
assert(r26.ok === false && r26.errorKind === "SCHEMA_INVALID", "unknown format rejected");

// 27. lowercase format normalized to canonical.
const lowerFormat = { ...validSnapshot, format: "reel" };
const r27 = parseRefinementResponse(JSON.stringify(lowerFormat));
assert(r27.ok === true && r27.data?.snapshot.format === "Reel", "lowercase format normalized");

// 28. parseStoredSnapshot backfills missing format from fallback.
const legacy = { ...validSnapshot, format: undefined };
const stored = parseStoredSnapshot(legacy, "Static");
assert(stored !== null && stored.format === "Static", "legacy snapshot backfilled with fallback format");

// 29. parseStoredSnapshot returns null for non-object.
assert(parseStoredSnapshot(null, "Reel") === null, "parseStoredSnapshot null → null");
assert(parseStoredSnapshot("oops", "Reel") === null, "parseStoredSnapshot string → null");

// 30. parseStoredSnapshot still rejects when other fields are invalid.
const brokenLegacy = { ...validSnapshot, format: undefined, body: "x".repeat(3001) };
assert(parseStoredSnapshot(brokenLegacy, "Static") === null, "legacy with other errors → null");

// 31. empty cta accepted (Static posts put CTA in caption).
const emptyCta = { ...validSnapshot, cta: "" };
const r31 = parseRefinementResponse(JSON.stringify(emptyCta));
assert(r31.ok === true, "empty cta accepted (Static-style)");

// ─── Summary ─────────────────────────────────────────────────────────────────
if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll refinement-prompt tests passed.");
}
