import { createHash } from "crypto";
import type { ListingComplianceStatus } from "@prisma/client";
import type { ListingFacts } from "./validation";
import type { ComplianceIssue, ComplianceResult } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Fair-housing and protected-class detection
//
// IMPORTANT: This scanner is a heuristic first-pass filter, not legal guidance.
// The patterns below reflect common advertising concerns raised in fair-housing
// literature. They are NOT a definitive statement about what fair-housing law
// requires, encourages, or prohibits — that determination is counsel-reviewed.
// When a pattern produces a false positive (blocks legitimate compliant
// language), remove or narrow the pattern rather than expanding the block list.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Protected-class targeting patterns.
 *
 * These are high-confidence phrases that commonly appear in fair-housing
 * training materials as advertising concerns. Not an exhaustive list.
 */
const PROTECTED_CLASS_PATTERNS: RegExp[] = [
  /\b(perfect\s+for\s+(?:families?|singles?|young\s+professionals?|retirees?|seniors?|couples?|empty\s*nesters?|students?|veterans?))\b/gi,
  /\b(ideal\s+for\s+(?:families?|singles?|young\s+professionals?|retirees?|seniors?|couples?|empty\s*nesters?|students?|veterans?))\b/gi,
  /\b(safe\s+neighborhood|unsafe\s+neighborhood|dangerous\s+area|high\s+crime\s+area)\b/gi,
  /\b(exclusive\s+community|restricted\s+community)\b/gi,
  // "everyone welcome" / "all welcome" / "anyone can live" were removed during
  // audit: they are inclusive phrases and flagging them is a scanner false
  // positive. Whether such language is required or encouraged in a given
  // jurisdiction is a counsel-reviewed determination, not a scanner decision.
];

/**
 * Fair-housing red-flag patterns.
 *
 * "discriminat*" is intentionally NOT matched as a blanket pattern: it is a
 * scanner false positive because it blocks disclaimers that include the word
 * "discriminate" (e.g., "We do not discriminate"). Whether such disclaimers
 * are legally required in a given jurisdiction is a counsel-reviewed
 * determination. The scanner only flags explicit discriminatory preference
 * statements, not the word itself.
 */
const FAIR_HOUSING_PATTERNS: RegExp[] = [
  /\b(steer|steering|redlin)\b/gi,
  /\b(prefer(?:red|ence)?\s+(?:race|color|religion|national\s+origin|sex|familial\s+status|disability|handicap))\b/gi,
  /\b(exclude|exclusion|reject)\s+(?:based\s+on|because\s+of)\b/gi,
  // "discriminat*" is excluded — see comment above.
];

/**
 * Neighborhood safety claims (not verifiable from property facts).
 */
const SAFETY_CLAIM_PATTERNS: RegExp[] = [
  /\b(safe\s+(?:neighborhood|area|community|street|block))\b/gi,
  /\b(unsafe|dangerous|high\s+crime|low\s+crime|crime[- ]rate)\b/gi,
  /\b(secure\s+area|protected\s+area|gated\s+community\s+is\s+safe)\b/gi,
];

/**
 * Unconfirmed school-quality claims.
 */
const SCHOOL_QUALITY_PATTERNS: RegExp[] = [
  /\b(top[- ]rated\s+schools?|best\s+schools?|award[- ]winning\s+schools?|excellent\s+schools?|great\s+schools?)\b/gi,
  /\b(rated\s+\d+(?:\.\d+)?\s+(?:out\s+of\s+\d+)?\s+schools?)\b/gi,
  /\b(A\+?\s+schools?|10\/10\s+schools?|blue\s+ribbon\s+schools?)\b/gi,
];

/**
 * Unsupported urgency and guarantee phrases.
 */
const URGENCY_GUARANTEE_PATTERNS: RegExp[] = [
  /\b(guaranteed\s+(?:sale|price|offer|closing|approval))\b/gi,
  /\b(will\s+sell\s+(?:fast|quickly|in\s+\d+\s+days))\b/gi,
  /\b(must\s+see\s+(?:today|now|immediately|before\s+it's\s+gone))\b/gi,
  /\b(won't\s+last\s+(?:long|at\s+this\s+price))\b/gi,
  /\b(act\s+(?:now|fast|today)\s+before)\b/gi,
];

// ─────────────────────────────────────────────────────────────────────────────
// Numeric grounding — property-claim context extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Property-claim number patterns. Only numbers matching these contexts are
 * verified against the confirmed facts snapshot.
 *
 * This distinguishes property claims (price, beds, baths, sqft, acreage, etc.)
 * from non-claim numbers (address street numbers, ZIP codes, phone numbers,
 * dates rendered as numbers, unit numbers).
 */
const PRICE_PATTERN = /\$\s?([\d,]+(?:\.\d+)?(?:k|K|m|M|million|billion|b)?)\b/g;
const BEDS_PATTERN = /\b(\d+)[\s-]?(?:bed|bedroom|bd)s?\b/gi;
const BATHS_PATTERN = /\b(\d+(?:\.\d+)?)\s*(?:bath|bathroom|ba)s?\b/gi;
const SQFT_PATTERN = /\b([\d,]+)\s*(?:sq\s*ft|sqft|square\s*feet|sf)\b/gi;
const ACREAGE_PATTERN = /\b([\d.]+)\s*(?:acre|acres|ac)\b/gi;
const YEAR_BUILT_PATTERN = /\b(?:built|constructed)\s+(?:in\s+)?(\d{4})\b/gi;
const HOA_PATTERN = /\bHOA\s*(?:is|of|fee|dues)?\s*\$?\s?([\d,]+(?:\.\d+)?)\s*(?:\/mo|\/month|per\s+month|monthly)?\b/gi;

/**
 * Extract all property-claim numbers from text, tagged by claim type.
 */
interface ExtractedClaimNumber {
  type: "price" | "beds" | "baths" | "sqft" | "acreage" | "yearBuilt" | "hoa";
  value: number;
  excerpt: string;
  field: "title" | "hook" | "caption" | "cta";
}

function extractClaimNumbers(text: string, field: ExtractedClaimNumber["field"]): ExtractedClaimNumber[] {
  const results: ExtractedClaimNumber[] = [];

  const extract = (
    pattern: RegExp,
    type: ExtractedClaimNumber["type"],
    parser: (match: string) => number | null
  ): void => {
    let match: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((match = re.exec(text)) !== null) {
      const parsed = parser(match[1]);
      if (parsed !== null && Number.isFinite(parsed)) {
        const start = Math.max(0, match.index - 20);
        const end = Math.min(text.length, match.index + match[0].length + 20);
        results.push({
          type,
          value: parsed,
          excerpt: text.slice(start, end).trim(),
          field,
        });
      }
    }
  };

  extract(PRICE_PATTERN, "price", (m) => {
    let num = parseFloat(m.replace(/,/g, ""));
    const lower = m.toLowerCase();
    if (lower.endsWith("k")) num *= 1_000;
    else if (lower.endsWith("m") || lower.endsWith("million")) num *= 1_000_000;
    else if (lower.endsWith("b") || lower.endsWith("billion")) num *= 1_000_000_000;
    return num;
  });

  extract(BEDS_PATTERN, "beds", (m) => parseInt(m, 10));
  extract(BATHS_PATTERN, "baths", (m) => parseFloat(m));
  extract(SQFT_PATTERN, "sqft", (m) => parseFloat(m.replace(/,/g, "")));
  extract(ACREAGE_PATTERN, "acreage", (m) => parseFloat(m));
  extract(YEAR_BUILT_PATTERN, "yearBuilt", (m) => parseInt(m, 10));
  extract(HOA_PATTERN, "hoa", (m) => parseFloat(m.replace(/,/g, "")));

  return results;
}

/**
 * Check extracted claim numbers against confirmed facts.
 */
function checkNumericGrounding(
  claims: ExtractedClaimNumber[],
  facts: ListingFacts
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];

  for (const claim of claims) {
    let factValue: number | null | undefined = null;
    let claimLabel = "";

    switch (claim.type) {
      case "price":
        factValue = facts.price ? parseFloat(facts.price) : null;
        claimLabel = "price";
        break;
      case "beds":
        factValue = facts.beds ?? null;
        claimLabel = "bedrooms";
        break;
      case "baths":
        factValue = facts.baths ?? null;
        claimLabel = "bathrooms";
        break;
      case "sqft":
        factValue = facts.squareFeet ?? null;
        claimLabel = "square feet";
        break;
      case "acreage":
        factValue = facts.acreage ?? null;
        claimLabel = "acreage";
        break;
      case "yearBuilt":
        factValue = facts.yearBuilt ?? null;
        claimLabel = "year built";
        break;
      case "hoa":
        factValue = facts.hoaAmount ? parseFloat(facts.hoaAmount.replace(/[^0-9.]/g, "")) : null;
        claimLabel = "HOA amount";
        break;
    }

    if (factValue === null || factValue === undefined) {
      issues.push({
        id: `numeric_${claim.type}_${claim.field}_${claim.value}`,
        severity: "WARNING",
        category: "ungrounded_number",
        message: `Content mentions a ${claimLabel} (${claim.value}) that is not in the confirmed facts. Verify before approving.`,
        field: claim.field,
        excerpt: claim.excerpt,
      });
    } else if (Math.abs(factValue - claim.value) > 0.01) {
      issues.push({
        id: `numeric_mismatch_${claim.type}_${claim.field}_${claim.value}`,
        severity: "BLOCKED",
        category: "number_mismatch",
        message: `Content claims ${claimLabel} is ${claim.value}, but confirmed facts say ${factValue}.`,
        field: claim.field,
        excerpt: claim.excerpt,
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// User compliance guardrails (from profile surveys)
// ─────────────────────────────────────────────────────────────────────────────

export interface UserComplianceGuardrails {
  forbiddenClaims?: string[];
  wordsToAvoid?: string[];
  requiredDisclaimers?: string[];
}

/**
 * Check content against user-specified compliance guardrails.
 */
function checkUserGuardrails(
  text: string,
  field: ExtractedClaimNumber["field"],
  guardrails: UserComplianceGuardrails
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const lowerText = text.toLowerCase();

  for (const forbidden of guardrails.forbiddenClaims ?? []) {
    if (forbidden.trim() && lowerText.includes(forbidden.trim().toLowerCase())) {
      issues.push({
        id: `user_forbidden_${field}_${forbidden.trim().slice(0, 30)}`,
        severity: "BLOCKED",
        category: "user_forbidden_claim",
        message: `Content contains a forbidden claim: "${forbidden.trim()}"`,
        field,
        excerpt: forbidden.trim(),
      });
    }
  }

  for (const word of guardrails.wordsToAvoid ?? []) {
    if (word.trim() && lowerText.includes(word.trim().toLowerCase())) {
      issues.push({
        id: `user_avoid_${field}_${word.trim().slice(0, 30)}`,
        severity: "WARNING",
        category: "user_word_to_avoid",
        message: `Content uses a word the user asked to avoid: "${word.trim()}"`,
        field,
        excerpt: word.trim(),
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main scan function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a deterministic compliance and factual-grounding scan over generated
 * listing content.
 *
 * This scanner is a heuristic first-pass filter, not legal guidance. It does
 * not guarantee factual or legal compliance. The content page must show a
 * static reminder that the user remains responsible for reviewing content
 * and applicable advertising requirements. Legal determinations about what
 * fair-housing law requires or prohibits are counsel-reviewed, not
 * scanner-determined.
 *
 * @param content - The generated content fields to scan.
 * @param facts - The confirmed listing facts snapshot to ground against.
 * @param guardrails - Optional user-specified compliance guardrails.
 */
export function scanCompliance(
  content: { title: string; hook: string; caption: string; cta: string },
  facts: ListingFacts,
  guardrails: UserComplianceGuardrails = {}
): ComplianceResult {
  const issues: ComplianceIssue[] = [];
  const fields: Array<{ name: ExtractedClaimNumber["field"]; text: string }> = [
    { name: "title", text: content.title },
    { name: "hook", text: content.hook },
    { name: "caption", text: content.caption },
    { name: "cta", text: content.cta },
  ];

  for (const { name, text } of fields) {
    // Protected-class targeting
    for (const pattern of PROTECTED_CLASS_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            id: `protected_class_${name}_${match.slice(0, 30)}`,
            severity: "BLOCKED",
            category: "protected_class_targeting",
            message: `Content may target a protected class: "${match}". This can violate fair-housing law.`,
            field: name,
            excerpt: match,
          });
        }
      }
    }

    // Fair-housing violations
    for (const pattern of FAIR_HOUSING_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            id: `fair_housing_${name}_${match.slice(0, 30)}`,
            severity: "BLOCKED",
            category: "fair_housing_violation",
            message: `Content contains a fair-housing red flag: "${match}".`,
            field: name,
            excerpt: match,
          });
        }
      }
    }

    // Neighborhood safety claims
    for (const pattern of SAFETY_CLAIM_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            id: `safety_${name}_${match.slice(0, 30)}`,
            severity: "WARNING",
            category: "safety_claim",
            message: `Content makes a neighborhood safety claim: "${match}". Safety claims are subjective and cannot be verified from property facts.`,
            field: name,
            excerpt: match,
          });
        }
      }
    }

    // School-quality claims
    for (const pattern of SCHOOL_QUALITY_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            id: `school_${name}_${match.slice(0, 30)}`,
            severity: "WARNING",
            category: "school_quality_claim",
            message: `Content makes a school-quality claim: "${match}". School quality claims require explicit confirmation.`,
            field: name,
            excerpt: match,
          });
        }
      }
    }

    // Unsupported urgency/guarantees
    for (const pattern of URGENCY_GUARANTEE_PATTERNS) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          issues.push({
            id: `urgency_${name}_${match.slice(0, 30)}`,
            severity: "WARNING",
            category: "unsupported_urgency",
            message: `Content contains an unsupported urgency or guarantee: "${match}".`,
            field: name,
            excerpt: match,
          });
        }
      }
    }

    // Numeric grounding (property-claim context only)
    const claims = extractClaimNumbers(text, name);
    issues.push(...checkNumericGrounding(claims, facts));

    // User compliance guardrails
    issues.push(...checkUserGuardrails(text, name, guardrails));
  }

  // Classify overall status
  const hasBlocked = issues.some((i) => i.severity === "BLOCKED");
  const hasWarning = issues.some((i) => i.severity === "WARNING");

  const status: ListingComplianceStatus = hasBlocked
    ? "BLOCKED"
    : hasWarning
      ? "WARNING"
      : "CLEAN";

  // Generate a digest of the findings for approval integrity.
  const digest = computeComplianceDigest(issues);

  return { status, issues, digest };
}

/**
 * Compute a stable digest of compliance issues.
 *
 * Used in approval metadata to detect if findings changed between approval
 * request and approval submission. A digest mismatch means the content was
 * regenerated or the facts changed — the user must re-acknowledge.
 */
export function computeComplianceDigest(issues: ComplianceIssue[]): string {
  const sorted = [...issues].sort((a, b) => a.id.localeCompare(b.id));
  const data = sorted.map((i) => `${i.id}:${i.severity}:${i.category}`).join("|");
  return createHash("sha256").update(data).digest("hex").slice(0, 32);
}
