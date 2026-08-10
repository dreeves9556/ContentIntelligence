import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireDashboardAccess, type DashboardAccessResult } from "@/lib/server-access";
import { isBetaUser } from "@/lib/account-access";
import type { AccountAccessUser } from "@/lib/account-access";
import type { UserPlan } from "@/lib/tiers";

/**
 * Listings access boundary.
 *
 * Two distinct functions:
 *
 * - `getListingsEligibility(accessUser)` — non-enforcing. For dashboard layout
 *   and Library tab visibility. Reuses the already-loaded access user (from
 *   `getAccessUser`, React-`cache`d) and a cached latest-questionnaire query.
 *   Never redirects or throws.
 *
 * - `requireListingsAccess()` — enforcing. For Listings pages, server actions,
 *   generation, refinement, Library queries, and import. Composes
 *   `requireDashboardAccess` → beta check → industry normalization. Never call
 *   this from the shared dashboard layout.
 *
 * Both delegate the decision logic to the pure `decideListingsEligibility`
 * helper so the access matrix is unit-testable without DB or auth mocks.
 */

export const REAL_ESTATE_INDUSTRY = "real_estate" as const;

const REAL_ESTATE_ALIASES = ["real estate", "realtor", "real estate agent"];

/**
 * Normalize an industry value for comparison.
 *
 * The onboarding value remains "Real Estate"; aliases only prevent historical
 * questionnaire values from breaking access.
 */
export function normalizeIndustry(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (REAL_ESTATE_ALIASES.includes(normalized)) {
    return REAL_ESTATE_INDUSTRY;
  }

  return normalized || null;
}

/**
 * Check whether a normalized industry value is Real Estate.
 */
export function isRealEstateIndustry(normalized: string | null): boolean {
  return normalized === REAL_ESTATE_INDUSTRY;
}

/**
 * Cached latest-questionnaire industry lookup for a user.
 *
 * Wrapped in React `cache` so repeated eligibility checks inside a single
 * request (layout + page + server actions) share one database round trip.
 */
export const getLatestQuestionnaireIndustry = cache(async (userId: string): Promise<string | null> => {
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });

  if (!questionnaire) return null;

  const content = questionnaire.content as unknown as { industry?: unknown };
  return normalizeIndustry(content?.industry);
});

export type ListingsAccessUser = AccountAccessUser & { plan: UserPlan };

export type ListingsAccessResult =
  | { allowed: true; user: ListingsAccessUser }
  | {
      allowed: false;
      reason: "UNAUTHENTICATED" | "DASHBOARD_BLOCKED" | "BETA_REQUIRED" | "INDUSTRY_REQUIRED";
      error: string;
    };

/**
 * Input shape for the pure eligibility decision.
 *
 * `industry` is the already-normalized industry string (or null) so the helper
 * has no async dependency. Production callers load it via
 * `getLatestQuestionnaireIndustry`; tests pass it directly.
 */
export interface ListingsEligibilityInput {
  role: AccountAccessUser["role"];
  isBeta: boolean;
  industry: string | null;
}

export type ListingsEligibilityDecision =
  | { eligible: true }
  | { eligible: false; reason: "BETA_REQUIRED" | "INDUSTRY_REQUIRED" };

/**
 * Pure eligibility decision — no DB, no auth, no side effects.
 *
 * Encodes the complete access matrix:
 *
 * | role   | isBeta | industry     | decision                  |
 * |--------|--------|--------------|---------------------------|
 * | ADMIN  | *      | *            | eligible (admin preview)  |
 * | USER   | false  | *            | BETA_REQUIRED             |
 * | USER   | true   | real_estate  | eligible                  |
 * | USER   | true   | other/null   | INDUSTRY_REQUIRED         |
 *
 * Both `getListingsEligibility` and `requireListingsAccess` delegate here.
 */
export function decideListingsEligibility(input: ListingsEligibilityInput): ListingsEligibilityDecision {
  if (input.role === "ADMIN") {
    return { eligible: true };
  }

  if (!input.isBeta) {
    return { eligible: false, reason: "BETA_REQUIRED" };
  }

  if (!isRealEstateIndustry(input.industry)) {
    return { eligible: false, reason: "INDUSTRY_REQUIRED" };
  }

  return { eligible: true };
}

/**
 * Non-enforcing eligibility check for dashboard layout and Library tab.
 *
 * Reuses the already-loaded access user (from `getAccessUser`, React-`cache`d)
 * and the cached latest-questionnaire query. Does NOT repeat authentication or
 * account queries. Never redirects or throws.
 *
 * Returns `{ eligible: true }` for beta-eligible Real Estate users and global
 * ADMIN users (admin preview exception).
 */
export async function getListingsEligibility(
  accessUser: AccountAccessUser & { plan: UserPlan }
): Promise<{ eligible: boolean; reason?: string }> {
  const industry = await getLatestQuestionnaireIndustry(accessUser.id);
  const decision = decideListingsEligibility({
    role: accessUser.role,
    isBeta: isBetaUser(accessUser),
    industry,
  });
  if (decision.eligible) {
    return { eligible: true };
  }
  return { eligible: false, reason: decision.reason };
}

/**
 * Enforcing access guard for Listings pages, server actions, generation,
 * refinement, Library queries, and import.
 *
 * Composes `requireDashboardAccess` → beta check → industry normalization.
 * Never call this from the shared dashboard layout — it risks redirecting
 * non-Real-Estate users away from every dashboard page.
 */
export async function requireListingsAccess(): Promise<ListingsAccessResult> {
  const access: DashboardAccessResult = await requireDashboardAccess();
  if (!access.allowed) {
    return {
      allowed: false,
      reason: access.status === 401 ? "UNAUTHENTICATED" : "DASHBOARD_BLOCKED",
      error: access.error,
    };
  }

  const user = access.user;
  const industry = await getLatestQuestionnaireIndustry(user.id);
  const decision = decideListingsEligibility({
    role: user.role,
    isBeta: isBetaUser(user),
    industry,
  });

  if (decision.eligible) {
    return { allowed: true, user };
  }

  switch (decision.reason) {
    case "BETA_REQUIRED":
      return {
        allowed: false,
        reason: "BETA_REQUIRED",
        error: "Listings is in beta. This feature is not available for your account.",
      };
    case "INDUSTRY_REQUIRED":
      return {
        allowed: false,
        reason: "INDUSTRY_REQUIRED",
        error: "Listings is only available for Real Estate professionals.",
      };
  }
}
