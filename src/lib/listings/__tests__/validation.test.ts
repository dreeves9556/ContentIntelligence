import {
  ListingFactsSchema,
  ListingInsightsSchema,
  ListingIntentDataSchema,
  ListingExtractionDraftSchema,
  ListingGenerationOutputSchema,
  validateFactsForIntent,
} from "../validation";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ListingFactsSchema
// ─────────────────────────────────────────────────────────────────────────────

const validFacts = {
  addressLine1: "123 Main St",
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  propertyType: "Single Family",
};

const factsResult = ListingFactsSchema.safeParse(validFacts);
assert(factsResult.success, "ListingFactsSchema: valid minimal facts pass");

const factsWithOptionals = ListingFactsSchema.safeParse({
  ...validFacts,
  price: "549000",
  beds: 4,
  baths: 2.5,
  squareFeet: 2100,
  acreage: 0.25,
  yearBuilt: 2015,
  features: ["granite countertops", "hardwood floors"],
});
assert(factsWithOptionals.success, "ListingFactsSchema: valid facts with optionals pass");

const missingRequired = ListingFactsSchema.safeParse({
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  propertyType: "Single Family",
});
assert(!missingRequired.success, "ListingFactsSchema: missing addressLine1 fails");

const negativeBeds = ListingFactsSchema.safeParse({
  ...validFacts,
  beds: -1,
});
assert(!negativeBeds.success, "ListingFactsSchema: negative beds fails");

const negativeSqft = ListingFactsSchema.safeParse({
  ...validFacts,
  squareFeet: -100,
});
assert(!negativeSqft.success, "ListingFactsSchema: negative square feet fails");

const nanBeds = ListingFactsSchema.safeParse({
  ...validFacts,
  beds: NaN,
});
assert(!nanBeds.success, "ListingFactsSchema: NaN beds fails");

const negativePrice = ListingFactsSchema.safeParse({
  ...validFacts,
  price: "-100000",
});
assert(!negativePrice.success, "ListingFactsSchema: negative price fails");

const tooManyFeatures = ListingFactsSchema.safeParse({
  ...validFacts,
  features: Array(51).fill("feature"),
});
assert(!tooManyFeatures.success, "ListingFactsSchema: over 50 features fails");

const futureYearBuilt = ListingFactsSchema.safeParse({
  ...validFacts,
  yearBuilt: 3000,
});
assert(!futureYearBuilt.success, "ListingFactsSchema: far-future year built fails");

const nullOptionals = ListingFactsSchema.safeParse({
  ...validFacts,
  addressLine2: null,
  price: null,
  beds: null,
});
assert(nullOptionals.success, "ListingFactsSchema: null optionals pass");

// ─────────────────────────────────────────────────────────────────────────────
// ListingInsightsSchema
// ─────────────────────────────────────────────────────────────────────────────

const validInsights = {
  favoriteRoom: "The kitchen with the big island",
  bestFeature: "Natural light everywhere",
};
const insightsResult = ListingInsightsSchema.safeParse(validInsights);
assert(insightsResult.success, "ListingInsightsSchema: valid insights pass");

const emptyInsights = ListingInsightsSchema.safeParse({});
assert(emptyInsights.success, "ListingInsightsSchema: empty object passes");

const longInsight = ListingInsightsSchema.safeParse({
  lifestyleDescription: "x".repeat(2001),
});
assert(!longInsight.success, "ListingInsightsSchema: over-limit string fails");

// ─────────────────────────────────────────────────────────────────────────────
// ListingIntentDataSchema (discriminated union)
// ─────────────────────────────────────────────────────────────────────────────

const openHouse = ListingIntentDataSchema.safeParse({
  intent: "OPEN_HOUSE",
  date: "2026-09-15",
  startTime: "14:00",
  endTime: "16:00",
  timezone: "America/Chicago",
});
assert(openHouse.success, "ListingIntentDataSchema: OPEN_HOUSE with all fields passes");

const openHouseMissingDate = ListingIntentDataSchema.safeParse({
  intent: "OPEN_HOUSE",
  startTime: "14:00",
  endTime: "16:00",
  timezone: "America/Chicago",
});
assert(!openHouseMissingDate.success, "ListingIntentDataSchema: OPEN_HOUSE missing date fails");

const priceImprovement = ListingIntentDataSchema.safeParse({
  intent: "PRICE_IMPROVEMENT",
  previousPrice: "550000",
  currentPrice: "525000",
});
assert(priceImprovement.success, "ListingIntentDataSchema: PRICE_IMPROVEMENT passes");

const justSold = ListingIntentDataSchema.safeParse({
  intent: "JUST_SOLD",
  salePrice: "520000",
  closingDate: "2026-08-01",
});
assert(justSold.success, "ListingIntentDataSchema: JUST_SOLD with sale price passes");

const justSoldNoPrice = ListingIntentDataSchema.safeParse({
  intent: "JUST_SOLD",
});
assert(justSoldNoPrice.success, "ListingIntentDataSchema: JUST_SOLD with no optional fields passes");

const custom = ListingIntentDataSchema.safeParse({
  intent: "CUSTOM",
  brief: "Focus on the backyard renovation",
});
assert(custom.success, "ListingIntentDataSchema: CUSTOM with brief passes");

const customEmpty = ListingIntentDataSchema.safeParse({
  intent: "CUSTOM",
  brief: "",
});
assert(!customEmpty.success, "ListingIntentDataSchema: CUSTOM with empty brief fails");

const comingSoon = ListingIntentDataSchema.safeParse({
  intent: "COMING_SOON",
});
assert(comingSoon.success, "ListingIntentDataSchema: COMING_SOON (empty intent) passes");

const justListed = ListingIntentDataSchema.safeParse({
  intent: "JUST_LISTED",
});
assert(justListed.success, "ListingIntentDataSchema: JUST_LISTED (empty intent) passes");

const invalidIntent = ListingIntentDataSchema.safeParse({
  intent: "INVALID_INTENT",
});
assert(!invalidIntent.success, "ListingIntentDataSchema: invalid intent fails");

// ─────────────────────────────────────────────────────────────────────────────
// ListingExtractionDraftSchema (nullable, for V1C)
// ─────────────────────────────────────────────────────────────────────────────

const partialExtraction = ListingExtractionDraftSchema.safeParse({
  addressLine1: "123 Main St",
  city: "Austin",
  price: "549000",
});
assert(partialExtraction.success, "ListingExtractionDraftSchema: partial extraction passes");

const emptyExtraction = ListingExtractionDraftSchema.safeParse({});
assert(emptyExtraction.success, "ListingExtractionDraftSchema: empty object passes");

const allNullExtraction = ListingExtractionDraftSchema.safeParse({
  addressLine1: null,
  city: null,
  price: null,
});
assert(allNullExtraction.success, "ListingExtractionDraftSchema: all nulls pass");

// ─────────────────────────────────────────────────────────────────────────────
// ListingGenerationOutputSchema
// ─────────────────────────────────────────────────────────────────────────────

const validOutput = ListingGenerationOutputSchema.safeParse({
  title: "Just Listed in Austin!",
  hook: "This 4-bed home is a must-see",
  caption: "Beautiful home in Austin with great features.",
  cta: "DM me for a showing",
});
assert(validOutput.success, "ListingGenerationOutputSchema: valid output passes");

const emptyHook = ListingGenerationOutputSchema.safeParse({
  title: "Test",
  hook: "",
  caption: "Caption",
  cta: "CTA",
});
assert(!emptyHook.success, "ListingGenerationOutputSchema: empty hook fails");

const longCaption = ListingGenerationOutputSchema.safeParse({
  title: "Test",
  hook: "Hook",
  caption: "x".repeat(2201),
  cta: "CTA",
});
assert(!longCaption.success, "ListingGenerationOutputSchema: over-limit caption fails");

// ─────────────────────────────────────────────────────────────────────────────
// validateFactsForIntent
// ─────────────────────────────────────────────────────────────────────────────

const priceImprovementErrors = validateFactsForIntent(
  validFacts as never,
  { intent: "PRICE_IMPROVEMENT", previousPrice: "550000", currentPrice: "525000" }
);
assert(
  priceImprovementErrors.some((e) => e.includes("Price is required")),
  "validateFactsForIntent: PRICE_IMPROVEMENT without facts.price warns"
);

const priceImprovementWithPrice = validateFactsForIntent(
  { ...validFacts, price: "549000" } as never,
  { intent: "PRICE_IMPROVEMENT", previousPrice: "550000", currentPrice: "525000" }
);
assert(
  priceImprovementWithPrice.length === 0,
  "validateFactsForIntent: PRICE_IMPROVEMENT with facts.price passes"
);

const openHouseErrors = validateFactsForIntent(
  validFacts as never,
  { intent: "OPEN_HOUSE", date: "", startTime: "14:00", endTime: "16:00", timezone: "America/Chicago" }
);
assert(
  openHouseErrors.some((e) => e.includes("Open house")),
  "validateFactsForIntent: OPEN_HOUSE with empty date warns"
);

const comingSoonErrors = validateFactsForIntent(
  validFacts as never,
  { intent: "COMING_SOON" }
);
assert(
  comingSoonErrors.length === 0,
  "validateFactsForIntent: COMING_SOON has no extra requirements"
);
