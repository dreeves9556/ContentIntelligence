import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Listing facts (confirmed property facts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirmed listing facts schema.
 *
 * Required: address line 1, city, state, postal code, property type.
 * Price: optional decimal-compatible string; required only for intents whose
 * UI requires it.
 *
 * No NaN, infinities, negative dimensions, or implausible values.
 * String limits on every field. Array limits on key features.
 */
export const ListingFactsSchema = z.object({
  // Required address fields
  addressLine1: z.string().trim().min(1).max(200),
  addressLine2: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(1).max(20),

  // Required property type
  propertyType: z.string().trim().min(1).max(100),

  // Price — optional decimal-compatible string (e.g., "549000" or "549000.00")
  price: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && isFinite(num) && num >= 0 && num < 10_000_000_000;
    }, "Price must be a non-negative number under 10 billion"),

  // Optional numeric facts
  beds: z
    .number()
    .min(0)
    .max(200)
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || (Number.isFinite(val) && !Number.isNaN(val)), "Beds must be a finite number"),
  baths: z
    .number()
    .min(0)
    .max(200)
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || (Number.isFinite(val) && !Number.isNaN(val)), "Baths must be a finite number"),
  squareFeet: z
    .number()
    .min(0)
    .max(10_000_000)
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || (Number.isFinite(val) && !Number.isNaN(val)), "Square feet must be a finite number"),
  acreage: z
    .number()
    .min(0)
    .max(1_000_000)
    .optional()
    .nullable()
    .refine((val) => val === null || val === undefined || (Number.isFinite(val) && !Number.isNaN(val)), "Acreage must be a finite number"),

  // Optional property facts
  yearBuilt: z.number().int().min(1500).max(new Date().getFullYear() + 5).optional().nullable(),
  parking: z.string().trim().max(200).optional().nullable(),
  hoaAmount: z.string().trim().max(100).optional().nullable(),
  taxes: z.string().trim().max(100).optional().nullable(),
  lotDescription: z.string().trim().max(500).optional().nullable(),
  features: z.array(z.string().trim().max(200)).max(50).optional().nullable().default([]),
  improvements: z.string().trim().max(2000).optional().nullable(),
  openHouseInfo: z.string().trim().max(1000).optional().nullable(),
  listingUrl: z.string().trim().max(2000).optional().nullable(),
  mlsDescription: z.string().trim().max(5000).optional().nullable(),
});

export type ListingFacts = z.infer<typeof ListingFactsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Agent insights (subjective context — not authoritative for objective claims)
// ─────────────────────────────────────────────────────────────────────────────

export const ListingInsightsSchema = z.object({
  favoriteRoom: z.string().trim().max(500).optional().nullable(),
  hiddenDetail: z.string().trim().max(500).optional().nullable(),
  bestFeature: z.string().trim().max(500).optional().nullable(),
  lifestyleDescription: z.string().trim().max(2000).optional().nullable(),
  improvementStory: z.string().trim().max(2000).optional().nullable(),
  localContext: z.string().trim().max(2000).optional().nullable(),
  likelyBuyerProblem: z.string().trim().max(1000).optional().nullable(),
});

export type ListingInsights = z.infer<typeof ListingInsightsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Intent data (discriminated Zod union per intent)
// ─────────────────────────────────────────────────────────────────────────────

const OpenHouseIntentDataSchema = z.object({
  intent: z.literal("OPEN_HOUSE"),
  date: z.string().trim().min(1).max(20), // YYYY-MM-DD
  startTime: z.string().trim().min(1).max(10), // HH:MM
  endTime: z.string().trim().min(1).max(10), // HH:MM
  timezone: z.string().trim().min(1).max(50), // IANA timezone
});

const PriceImprovementIntentDataSchema = z.object({
  intent: z.literal("PRICE_IMPROVEMENT"),
  previousPrice: z.string().trim().min(1).max(20),
  currentPrice: z.string().trim().min(1).max(20),
});

const JustSoldIntentDataSchema = z.object({
  intent: z.literal("JUST_SOLD"),
  salePrice: z.string().trim().max(20).optional().nullable(),
  closingDate: z.string().trim().max(20).optional().nullable(), // YYYY-MM-DD
});

const CustomIntentDataSchema = z.object({
  intent: z.literal("CUSTOM"),
  brief: z.string().trim().min(1).max(2000),
});

const EmptyIntentDataSchema = z.object({
  intent: z.enum([
    "COMING_SOON",
    "JUST_LISTED",
    "PROPERTY_SPOTLIGHT",
    "UNDER_CONTRACT",
  ]),
});

export const ListingIntentDataSchema = z.discriminatedUnion("intent", [
  OpenHouseIntentDataSchema,
  PriceImprovementIntentDataSchema,
  JustSoldIntentDataSchema,
  CustomIntentDataSchema,
  EmptyIntentDataSchema,
]);

export type ListingIntentData = z.infer<typeof ListingIntentDataSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Extraction draft (V1C — nullable, for URL import)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Nullable extraction draft schema for URL import.
 *
 * Unlike ListingFactsSchema, every field is optional/nullable because unknown
 * fields are expected from extraction. Do not let extraction use the required
 * ListingFactsSchema directly.
 */
export const ListingExtractionDraftSchema = z.object({
  addressLine1: z.string().trim().max(200).optional().nullable(),
  addressLine2: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  state: z.string().trim().max(100).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  propertyType: z.string().trim().max(100).optional().nullable(),
  price: z.string().trim().max(20).optional().nullable(),
  beds: z.number().min(0).max(200).optional().nullable(),
  baths: z.number().min(0).max(200).optional().nullable(),
  squareFeet: z.number().min(0).max(10_000_000).optional().nullable(),
  acreage: z.number().min(0).max(1_000_000).optional().nullable(),
  yearBuilt: z.number().int().min(1500).max(new Date().getFullYear() + 5).optional().nullable(),
  parking: z.string().trim().max(200).optional().nullable(),
  hoaAmount: z.string().trim().max(100).optional().nullable(),
  taxes: z.string().trim().max(100).optional().nullable(),
  lotDescription: z.string().trim().max(500).optional().nullable(),
  features: z.array(z.string().trim().max(200)).max(50).optional().nullable(),
  improvements: z.string().trim().max(2000).optional().nullable(),
  mlsDescription: z.string().trim().max(5000).optional().nullable(),
  listingUrl: z.string().trim().max(2000).optional().nullable(),
});

export type ListingExtractionDraft = z.infer<typeof ListingExtractionDraftSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Generation output schema (V1A output contract)
// ─────────────────────────────────────────────────────────────────────────────

export const ListingGenerationOutputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(1).max(500),
  caption: z.string().trim().min(1).max(2200),
  cta: z.string().trim().min(1).max(300),
});

export type ListingGenerationOutput = z.infer<typeof ListingGenerationOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that the facts required for a given intent are present.
 * Price is required for PRICE_IMPROVEMENT and JUST_SOLD (when salePrice is absent).
 */
export function validateFactsForIntent(
  facts: ListingFacts,
  intentData: ListingIntentData
): string[] {
  const errors: string[] = [];

  if (intentData.intent === "PRICE_IMPROVEMENT") {
    if (!facts.price) {
      errors.push("Price is required for Price Improvement content.");
    }
    if (!intentData.currentPrice) {
      errors.push("Current price is required for Price Improvement content.");
    }
  }

  if (intentData.intent === "JUST_SOLD") {
    if (!facts.price && !intentData.salePrice) {
      errors.push("Sale price or listing price is required for Just Sold content.");
    }
  }

  if (intentData.intent === "OPEN_HOUSE") {
    if (!intentData.date || !intentData.startTime || !intentData.endTime) {
      errors.push("Open house date, start time, and end time are required.");
    }
  }

  return errors;
}
