import type {
  ListingSourceType,
  ListingStatus,
  ListingContentIntent,
  ListingAssetType,
  ListingContentStatus,
  ListingContentVersionSource,
  ListingComplianceStatus,
  ListingGenerationRequestStatus,
} from "@prisma/client";

// Re-export Prisma enum types for convenience
export type {
  ListingSourceType,
  ListingStatus,
  ListingContentIntent,
  ListingAssetType,
  ListingContentStatus,
  ListingContentVersionSource,
  ListingComplianceStatus,
  ListingGenerationRequestStatus,
};

// ─────────────────────────────────────────────────────────────────────────────
// Listing DTOs (server → client)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A listing as returned to the client. Decimal price is serialized to string
 * before crossing the server/client boundary (Prisma Decimal is not JSON-safe).
 */
export interface ListingDTO {
  id: string;
  userId: string;
  sourceType: ListingSourceType;
  sourceUrl: string | null;
  normalizedSourceUrl: string | null;
  status: ListingStatus;

  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  normalizedAddress: string;
  propertyType: string;
  price: string | null; // Decimal serialized to string

  factsJson: Record<string, unknown>;
  insightsJson: Record<string, unknown>;
  extractedFactsJson: Record<string, unknown> | null;
  factsRevision: number;
  factsConfirmedAt: string | null;

  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;

  contentCount: number;
}

/**
 * A listing content asset as returned to the client.
 */
export interface ListingContentDTO {
  id: string;
  listingId: string;
  userId: string;
  intent: ListingContentIntent;
  intentDataJson: Record<string, unknown>;
  assetType: ListingAssetType;
  platform: string;
  status: ListingContentStatus;

  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  musicSuggestion: string | null;
  duration: string | null;
  directions: string | null;

  currentVersionId: string | null;
  approvedVersionId: string | null;
  approvedAt: string | null;

  createdAt: string;
  updatedAt: string;
}

/**
 * An immutable content version as returned to the client.
 */
export interface ListingContentVersionDTO {
  id: string;
  contentId: string;
  versionNumber: number;
  source: ListingContentVersionSource;

  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  musicSuggestion: string | null;
  duration: string | null;
  directions: string | null;

  changeSummary: string | null;
  factsRevision: number;
  complianceStatus: ListingComplianceStatus;
  complianceIssuesJson: Record<string, unknown> | null;

  aiModel: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  estimatedCostMicrodollars: number | null;
  latencyMs: number | null;

  previousVersionId: string | null;
  restoredFromVersionId: string | null;
  createdAt: string;
}

/**
 * A Library item as returned to the client.
 */
export interface ListingLibraryItemDTO {
  id: string;
  listingId: string;
  contentId: string;
  versionId: string;
  savedAt: string;

  listing: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    propertyType: string;
    price: string | null;
  };

  version: Omit<
    ListingContentVersionDTO,
    "factsRevision" | "aiModel" | "promptTokens" | "completionTokens" | "estimatedCostMicrodollars" | "latencyMs" | "previousVersionId" | "restoredFromVersionId"
  >;

  content: {
    id: string;
    intent: ListingContentIntent;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Action result types
// ─────────────────────────────────────────────────────────────────────────────

export type ListingActionResult =
  | { success: true; listing: ListingDTO }
  | { success: false; error: string };

export type ContentActionResult =
  | { success: true; content: ListingContentDTO }
  | { success: false; error: string };

export type GenerationActionResult =
  | { success: true; contentId: string }
  | { success: true; status: "IN_PROGRESS" }
  | { success: false; error: string };

export type ApprovalActionResult =
  | { success: true; content: ListingContentDTO }
  | { success: false; error: string; complianceIssues?: unknown[] };

export type LibrarySaveActionResult =
  | { success: true; libraryItemId: string; alreadyExists: boolean }
  | { success: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Generation claim types
// ─────────────────────────────────────────────────────────────────────────────

export interface ListingGenerationClaimExistingRow {
  id: string;
  status: ListingGenerationRequestStatus | string;
  claimToken: string | null;
  claimedAt: Date | null;
  requestParamsHash: string | null;
  resultingContentId: string | null;
  userId: string | null;
}

export interface ListingGenerationClaimRequest {
  requestId: string;
  userId: string;
  listingId: string;
  intent: ListingContentIntent;
  intentDataHash: string;
}

export type ListingGenerationClaimDecision =
  | { kind: "CLAIM_NEW" }
  | { kind: "COMPLETED"; contentId: string | null }
  | { kind: "IN_PROGRESS" }
  | { kind: "RECLAIM"; rowId: string; fromStatus: "PROCESSING" | "FAILED" }
  | { kind: "PARAM_MISMATCH" };

// ─────────────────────────────────────────────────────────────────────────────
// Compliance types
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceIssue {
  id: string;
  severity: "WARNING" | "BLOCKED";
  category: string;
  message: string;
  field: "title" | "hook" | "caption" | "cta" | null;
  excerpt?: string;
}

export interface ComplianceResult {
  status: ListingComplianceStatus;
  issues: ComplianceIssue[];
  digest: string;
}

export interface ApprovalMeta {
  versionId: string;
  complianceDigest: string;
  acknowledgedIssueIds: string[];
  acknowledgedAt: string;
}
