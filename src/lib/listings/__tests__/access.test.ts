import {
  normalizeIndustry,
  isRealEstateIndustry,
  REAL_ESTATE_INDUSTRY,
  decideListingsEligibility,
} from "../access";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeIndustry
// ─────────────────────────────────────────────────────────────────────────────

assert(
  REAL_ESTATE_INDUSTRY === "real_estate",
  "REAL_ESTATE_INDUSTRY is 'real_estate'"
);

assert(
  normalizeIndustry("Real Estate") === "real_estate",
  "normalizeIndustry: 'Real Estate' → 'real_estate'"
);

assert(
  normalizeIndustry("Realtor") === "real_estate",
  "normalizeIndustry: 'Realtor' → 'real_estate'"
);

assert(
  normalizeIndustry("Real Estate Agent") === "real_estate",
  "normalizeIndustry: 'Real Estate Agent' → 'real_estate'"
);

assert(
  normalizeIndustry("real estate") === "real_estate",
  "normalizeIndustry: 'real estate' (lowercase) → 'real_estate'"
);

assert(
  normalizeIndustry("REAL ESTATE") === "real_estate",
  "normalizeIndustry: 'REAL ESTATE' (uppercase) → 'real_estate'"
);

assert(
  normalizeIndustry("real_estate") === "real_estate",
  "normalizeIndustry: 'real_estate' (underscore) → 'real_estate'"
);

assert(
  normalizeIndustry("real-estate") === "real_estate",
  "normalizeIndustry: 'real-estate' (hyphen) → 'real_estate'"
);

assert(
  normalizeIndustry("  Real  Estate  ") === "real_estate",
  "normalizeIndustry: trims and collapses whitespace"
);

assert(
  normalizeIndustry("Restaurant") === "restaurant",
  "normalizeIndustry: non-real-estate passes through normalized"
);

assert(
  normalizeIndustry("Fitness Coach") === "fitness coach",
  "normalizeIndustry: multi-word non-real-estate passes through"
);

assert(
  normalizeIndustry("") === null,
  "normalizeIndustry: empty string returns null"
);

assert(
  normalizeIndustry("   ") === null,
  "normalizeIndustry: whitespace-only returns null"
);

assert(
  normalizeIndustry(null) === null,
  "normalizeIndustry: null returns null"
);

assert(
  normalizeIndustry(undefined) === null,
  "normalizeIndustry: undefined returns null"
);

assert(
  normalizeIndustry(123) === null,
  "normalizeIndustry: non-string returns null"
);

// ─────────────────────────────────────────────────────────────────────────────
// isRealEstateIndustry
// ─────────────────────────────────────────────────────────────────────────────

assert(
  isRealEstateIndustry("real_estate") === true,
  "isRealEstateIndustry: 'real_estate' is true"
);

assert(
  isRealEstateIndustry("restaurant") === false,
  "isRealEstateIndustry: 'restaurant' is false"
);

assert(
  isRealEstateIndustry(null) === false,
  "isRealEstateIndustry: null is false"
);

assert(
  isRealEstateIndustry("") === false,
  "isRealEstateIndustry: empty string is false"
);

// ─────────────────────────────────────────────────────────────────────────────
// decideListingsEligibility — full access matrix
// ─────────────────────────────────────────────────────────────────────────────
//
// | role   | isBeta | industry     | decision                  |
// |--------|--------|--------------|---------------------------|
// | ADMIN  | *      | *            | eligible (admin preview)  |
// | USER   | false  | *            | BETA_REQUIRED             |
// | USER   | true   | real_estate  | eligible                  |
// | USER   | true   | other/null   | INDUSTRY_REQUIRED         |

// ADMIN — admin preview exception (bypasses beta and industry)
let d = decideListingsEligibility({ role: "ADMIN", isBeta: false, industry: null });
assert(d.eligible === true, "ADMIN + non-beta + null industry → eligible (admin preview)");

d = decideListingsEligibility({ role: "ADMIN", isBeta: false, industry: "restaurant" });
assert(d.eligible === true, "ADMIN + non-beta + non-RE industry → eligible (admin preview)");

d = decideListingsEligibility({ role: "ADMIN", isBeta: true, industry: "real_estate" });
assert(d.eligible === true, "ADMIN + beta + RE industry → eligible");

d = decideListingsEligibility({ role: "ADMIN", isBeta: true, industry: null });
assert(d.eligible === true, "ADMIN + beta + null industry → eligible (admin preview)");

// USER + non-beta → BETA_REQUIRED (regardless of industry)
d = decideListingsEligibility({ role: "USER", isBeta: false, industry: "real_estate" });
assert(d.eligible === false && d.reason === "BETA_REQUIRED", "USER + non-beta + RE industry → BETA_REQUIRED");

d = decideListingsEligibility({ role: "USER", isBeta: false, industry: "restaurant" });
assert(d.eligible === false && d.reason === "BETA_REQUIRED", "USER + non-beta + non-RE industry → BETA_REQUIRED");

d = decideListingsEligibility({ role: "USER", isBeta: false, industry: null });
assert(d.eligible === false && d.reason === "BETA_REQUIRED", "USER + non-beta + null industry → BETA_REQUIRED");

// USER + beta + Real Estate → eligible
d = decideListingsEligibility({ role: "USER", isBeta: true, industry: "real_estate" });
assert(d.eligible === true, "USER + beta + RE industry → eligible");

// USER + beta + non-Real-Estate → INDUSTRY_REQUIRED
d = decideListingsEligibility({ role: "USER", isBeta: true, industry: "restaurant" });
assert(d.eligible === false && d.reason === "INDUSTRY_REQUIRED", "USER + beta + non-RE industry → INDUSTRY_REQUIRED");

d = decideListingsEligibility({ role: "USER", isBeta: true, industry: "fitness coach" });
assert(d.eligible === false && d.reason === "INDUSTRY_REQUIRED", "USER + beta + other industry → INDUSTRY_REQUIRED");

// USER + beta + null industry → INDUSTRY_REQUIRED
d = decideListingsEligibility({ role: "USER", isBeta: true, industry: null });
assert(d.eligible === false && d.reason === "INDUSTRY_REQUIRED", "USER + beta + null industry → INDUSTRY_REQUIRED");

// USER + beta + empty string industry → INDUSTRY_REQUIRED
d = decideListingsEligibility({ role: "USER", isBeta: true, industry: "" });
assert(d.eligible === false && d.reason === "INDUSTRY_REQUIRED", "USER + beta + empty industry → INDUSTRY_REQUIRED");

// ─────────────────────────────────────────────────────────────────────────────
// decideListingsEligibility — precedence (beta checked before industry)
// ─────────────────────────────────────────────────────────────────────────────

// Non-beta + non-RE: BETA_REQUIRED wins (not INDUSTRY_REQUIRED)
d = decideListingsEligibility({ role: "USER", isBeta: false, industry: "restaurant" });
assert(
  d.eligible === false && d.reason === "BETA_REQUIRED",
  "Precedence: non-beta + non-RE → BETA_REQUIRED (beta checked first)"
);

// ADMIN precedence: admin bypass wins over non-beta
d = decideListingsEligibility({ role: "ADMIN", isBeta: false, industry: "restaurant" });
assert(
  d.eligible === true,
  "Precedence: ADMIN + non-beta + non-RE → eligible (admin bypass wins)"
);
