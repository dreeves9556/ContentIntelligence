import { scanCompliance, computeComplianceDigest } from "../compliance";
import type { ListingFacts } from "../validation";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const baseFacts: ListingFacts = {
  addressLine1: "123 Main St",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  propertyType: "Single Family",
  price: "549000",
  beds: 4,
  baths: 2.5,
  squareFeet: 2100,
  acreage: 0.25,
  yearBuilt: 2015,
  features: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// CLEAN content
// ─────────────────────────────────────────────────────────────────────────────

const cleanResult = scanCompliance(
  {
    title: "Just Listed in Austin!",
    hook: "This 4-bed, 2.5-bath home is a must-see",
    caption: "Beautiful 2,100 sq ft home in Austin. Built in 2015, on a 0.25 acre lot.",
    cta: "DM me for a showing",
  },
  baseFacts
);
assert(cleanResult.status === "CLEAN", "scanCompliance: content matching facts is CLEAN");
assert(cleanResult.issues.length === 0, "scanCompliance: CLEAN has no issues");

// ─────────────────────────────────────────────────────────────────────────────
// Protected-class targeting (BLOCKED)
// ─────────────────────────────────────────────────────────────────────────────

const protectedResult = scanCompliance(
  {
    title: "Perfect for families",
    hook: "Great home",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  protectedResult.status === "BLOCKED",
  "scanCompliance: 'perfect for families' is BLOCKED"
);
assert(
  protectedResult.issues.some((i) => i.category === "protected_class_targeting"),
  "scanCompliance: protected-class issue detected"
);

// ─────────────────────────────────────────────────────────────────────────────
// Fair-housing violation (BLOCKED)
// ─────────────────────────────────────────────────────────────────────────────

const fairHousingResult = scanCompliance(
  {
    title: "Great home",
    hook: "No steering here",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  fairHousingResult.status === "BLOCKED",
  "scanCompliance: 'steering' is BLOCKED"
);

// ─────────────────────────────────────────────────────────────────────────────
// Safety claim (WARNING)
// ─────────────────────────────────────────────────────────────────────────────

const safetyResult = scanCompliance(
  {
    title: "Great home",
    hook: "In a safe neighborhood",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
// "safe neighborhood" is BLOCKED — it appears in both PROTECTED_CLASS_PATTERNS
// (fair-housing concern: implying safety can be discriminatory steering) and
// SAFETY_CLAIM_PATTERNS (unverifiable claim). BLOCKED takes precedence.
assert(
  safetyResult.status === "BLOCKED",
  "scanCompliance: 'safe neighborhood' is BLOCKED (protected-class + safety)"
);
assert(
  safetyResult.issues.some((i) => i.category === "safety_claim"),
  "scanCompliance: safety claim issue detected"
);

// ─────────────────────────────────────────────────────────────────────────────
// School quality claim (WARNING)
// ─────────────────────────────────────────────────────────────────────────────

const schoolResult = scanCompliance(
  {
    title: "Great home",
    hook: "Near top-rated schools",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  schoolResult.status === "WARNING",
  "scanCompliance: 'top-rated schools' is WARNING"
);
assert(
  schoolResult.issues.some((i) => i.category === "school_quality_claim"),
  "scanCompliance: school quality issue detected"
);

// ─────────────────────────────────────────────────────────────────────────────
// Unsupported urgency (WARNING)
// ─────────────────────────────────────────────────────────────────────────────

const urgencyResult = scanCompliance(
  {
    title: "Great home",
    hook: "Won't last long at this price",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  urgencyResult.status === "WARNING",
  "scanCompliance: 'won't last long at this price' is WARNING"
);

// ─────────────────────────────────────────────────────────────────────────────
// Numeric grounding — mismatch (BLOCKED)
// ─────────────────────────────────────────────────────────────────────────────

const mismatchResult = scanCompliance(
  {
    title: "Great home",
    hook: "This 5-bed home is amazing",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  mismatchResult.status === "BLOCKED",
  "scanCompliance: 5 beds vs 4 confirmed is BLOCKED"
);
assert(
  mismatchResult.issues.some((i) => i.category === "number_mismatch"),
  "scanCompliance: number mismatch detected"
);

// ─────────────────────────────────────────────────────────────────────────────
// Numeric grounding — ungrounded number (WARNING)
// ─────────────────────────────────────────────────────────────────────────────

const ungroundedResult = scanCompliance(
  {
    title: "Great home",
    hook: "Only $600,000",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  { ...baseFacts, price: undefined } as ListingFacts
);
assert(
  ungroundedResult.status === "WARNING",
  "scanCompliance: price not in facts is WARNING"
);
assert(
  ungroundedResult.issues.some((i) => i.category === "ungrounded_number"),
  "scanCompliance: ungrounded number detected"
);

// ─────────────────────────────────────────────────────────────────────────────
// Numeric grounding — non-claim numbers are NOT flagged
// ─────────────────────────────────────────────────────────────────────────────

const nonClaimNumbers = scanCompliance(
  {
    title: "123 Main St is ready",
    hook: "Call 555-123-4567",
    caption: "ZIP 78701. Available 2026.",
    cta: "DM me",
  },
  baseFacts
);
const hasNumericIssue = nonClaimNumbers.issues.some(
  (i) => i.category === "ungrounded_number" || i.category === "number_mismatch"
);
assert(
  !hasNumericIssue,
  "scanCompliance: address numbers, ZIP, phone, and dates are NOT flagged as numeric issues"
);

// ─────────────────────────────────────────────────────────────────────────────
// Numeric grounding — price with k/m suffixes
// ─────────────────────────────────────────────────────────────────────────────

const priceK = scanCompliance(
  {
    title: "Great home",
    hook: "Priced at $549k",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  !priceK.issues.some((i) => i.category === "number_mismatch"),
  "scanCompliance: $549k matches $549000"
);

const priceMismatch = scanCompliance(
  {
    title: "Great home",
    hook: "Priced at $600k",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  priceMismatch.issues.some((i) => i.category === "number_mismatch"),
  "scanCompliance: $600k does not match $549000"
);

// ─────────────────────────────────────────────────────────────────────────────
// User compliance guardrails
// ─────────────────────────────────────────────────────────────────────────────

const userGuardrails = scanCompliance(
  {
    title: "Great home",
    hook: "This is the best investment ever",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts,
  {
    forbiddenClaims: ["best investment"],
    wordsToAvoid: ["amazing"],
  }
);
assert(
  userGuardrails.status === "BLOCKED",
  "scanCompliance: user forbidden claim is BLOCKED"
);
assert(
  userGuardrails.issues.some((i) => i.category === "user_forbidden_claim"),
  "scanCompliance: user forbidden claim detected"
);

const userAvoid = scanCompliance(
  {
    title: "Amazing home",
    hook: "Great home",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts,
  { wordsToAvoid: ["amazing"] }
);
assert(
  userAvoid.issues.some((i) => i.category === "user_word_to_avoid"),
  "scanCompliance: user word to avoid detected as WARNING"
);

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED + WARNING → BLOCKED wins
// ─────────────────────────────────────────────────────────────────────────────

const mixedResult = scanCompliance(
  {
    title: "Perfect for families",
    hook: "In a safe neighborhood",
    caption: "Beautiful home.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  mixedResult.status === "BLOCKED",
  "scanCompliance: BLOCKED + WARNING → BLOCKED"
);

// ─────────────────────────────────────────────────────────────────────────────
// Inclusive language is NOT flagged (scanner false positive correction)
// ─────────────────────────────────────────────────────────────────────────────

const inclusiveResult = scanCompliance(
  {
    title: "Everyone welcome here",
    hook: "All are welcome to see this home",
    caption: "Anyone can live in this beautiful community.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  inclusiveResult.status === "CLEAN",
  "scanCompliance: 'everyone welcome' / 'all welcome' / 'anyone can live' is CLEAN (inclusive language)"
);
assert(
  !inclusiveResult.issues.some((i) => i.category === "protected_class_targeting"),
  "scanCompliance: inclusive language does not trigger protected-class targeting"
);

// "We do not discriminate" is a common fair-housing disclaimer — NOT blocked
// (scanner false positive: blanket "discriminat*" match would block it)
const disclaimerResult = scanCompliance(
  {
    title: "Beautiful home",
    hook: "We do not discriminate based on race, color, religion, or national origin",
    caption: "Equal Housing Opportunity.",
    cta: "Call me",
  },
  baseFacts
);
assert(
  disclaimerResult.status === "CLEAN",
  "scanCompliance: 'We do not discriminate' disclaimer is CLEAN"
);
assert(
  !disclaimerResult.issues.some((i) => i.category === "fair_housing_violation"),
  "scanCompliance: fair-housing disclaimer does not trigger fair-housing violation"
);

// ─────────────────────────────────────────────────────────────────────────────
// computeComplianceDigest
// ─────────────────────────────────────────────────────────────────────────────

const digest1 = computeComplianceDigest([
  { id: "a", severity: "WARNING", category: "cat1", message: "msg", field: null },
  { id: "b", severity: "BLOCKED", category: "cat2", message: "msg", field: null },
]);
const digest2 = computeComplianceDigest([
  { id: "b", severity: "BLOCKED", category: "cat2", message: "msg", field: null },
  { id: "a", severity: "WARNING", category: "cat1", message: "msg", field: null },
]);
assert(
  digest1 === digest2,
  "computeComplianceDigest: order-independent"
);

assert(
  digest1.length === 32,
  "computeComplianceDigest: 32-char hex digest"
);

const digest3 = computeComplianceDigest([
  { id: "a", severity: "BLOCKED", category: "cat1", message: "msg", field: null },
]);
assert(
  digest1 !== digest3,
  "computeComplianceDigest: different issues → different digest"
);
