import type { UserPlan } from "@/lib/tiers";
import type { BillingInterval, PurchaseType } from "@/lib/pricing";

/**
 * Centralized Stripe environment variable names and configuration checks.
 *
 * This file is the single source of truth for which env vars the app expects
 * and how "configured" status is determined. Server-side only.
 *
 * Pricing calculators have been moved to src/lib/pricing.ts (isomorphic).
 * They are re-exported here for backward compatibility.
 */

export type { BillingInterval, PurchaseType } from "@/lib/pricing";
export {
  COMMUNITY_MONTHLY_TIERS,
  calculateCommunityMonthlyTotal,
  calculateCommunityAnnualTotal,
  centsToDollars,
} from "@/lib/pricing";

export const STRIPE_ENV_KEYS = {
  secretKey: "STRIPE_SECRET_KEY",
  soloMonthlyPriceId: "STRIPE_SOLO_MONTHLY_PRICE_ID",
  soloAnnualPriceId: "STRIPE_SOLO_ANNUAL_PRICE_ID",
  communityMonthlyPriceId: "STRIPE_COMMUNITY_MONTHLY_PRICE_ID",
  communityAnnualPriceId: "STRIPE_COMMUNITY_ANNUAL_PRICE_ID",
  webhookSecret: "STRIPE_WEBHOOK_SECRET",
  appUrl: "NEXT_PUBLIC_APP_URL",
} as const;

const CHECKOUT_KEYS = [
  STRIPE_ENV_KEYS.secretKey,
  STRIPE_ENV_KEYS.soloMonthlyPriceId,
  STRIPE_ENV_KEYS.soloAnnualPriceId,
  STRIPE_ENV_KEYS.communityMonthlyPriceId,
  STRIPE_ENV_KEYS.communityAnnualPriceId,
  STRIPE_ENV_KEYS.appUrl,
] as const;

const WEBHOOK_KEYS = [STRIPE_ENV_KEYS.webhookSecret] as const;

/** Whether checkout can function (secret key + all price IDs + app URL). */
export function isStripeCheckoutConfigured(): boolean {
  return CHECKOUT_KEYS.every((key) => {
    const val = process.env[key];
    return typeof val === "string" && val.trim().length > 0;
  });
}

/** Whether webhook processing can function (webhook secret present). */
export function isStripeWebhookConfigured(): boolean {
  return WEBHOOK_KEYS.every((key) => {
    const val = process.env[key];
    return typeof val === "string" && val.trim().length > 0;
  });
}

/** Whether everything is configured (checkout + webhook). */
export function isStripeFullyConfigured(): boolean {
  return isStripeCheckoutConfigured() && isStripeWebhookConfigured();
}

/** Backward-compatible alias for isStripeCheckoutConfigured. */
export const isStripeConfigured = isStripeCheckoutConfigured;

export interface StripeConfigStatus {
  checkoutConfigured: boolean;
  webhookConfigured: boolean;
  fullyConfigured: boolean;
  missingCheckoutKeys: string[];
  missingWebhookKeys: string[];
  mode: "test" | "live" | "unknown";
  safeSummary: Record<string, string>;
}

/**
 * Returns a detailed (but secret-safe) config status object.
 * Never includes full secret values — only prefixes and booleans.
 */
export function getStripeConfigStatus(): StripeConfigStatus {
  const missingCheckoutKeys = CHECKOUT_KEYS.filter((key) => {
    const val = process.env[key];
    return typeof val !== "string" || val.trim().length === 0;
  });
  const missingWebhookKeys = WEBHOOK_KEYS.filter((key) => {
    const val = process.env[key];
    return typeof val !== "string" || val.trim().length === 0;
  });

  const checkoutConfigured = missingCheckoutKeys.length === 0;
  const webhookConfigured = missingWebhookKeys.length === 0;

  const secretKey = process.env[STRIPE_ENV_KEYS.secretKey];
  const mode: "test" | "live" | "unknown" = secretKey
    ? secretKey.startsWith("sk_test_")
      ? "test"
      : secretKey.startsWith("sk_live_")
        ? "live"
        : "unknown"
    : "unknown";

  const safeSummary: Record<string, string> = {};
  for (const key of CHECKOUT_KEYS) {
    const val = process.env[key];
    if (!val) {
      safeSummary[key] = "missing";
    } else if (key === STRIPE_ENV_KEYS.secretKey) {
      safeSummary[key] = `present, prefix ${val.slice(0, 8)}…`;
    } else if (key === STRIPE_ENV_KEYS.appUrl) {
      safeSummary[key] = `present, value ${val}`;
    } else if (val.startsWith("price_")) {
      safeSummary[key] = `present, prefix price_`;
    } else if (val.startsWith("whsec_")) {
      safeSummary[key] = `present, prefix whsec_`;
    } else {
      safeSummary[key] = `present, prefix ${val.slice(0, 6)}…`;
    }
  }
  for (const key of WEBHOOK_KEYS) {
    const val = process.env[key];
    safeSummary[key] = val
      ? val.startsWith("whsec_")
        ? "present, prefix whsec_"
        : `present, prefix ${val.slice(0, 6)}…`
      : "missing";
  }

  return {
    checkoutConfigured,
    webhookConfigured,
    fullyConfigured: checkoutConfigured && webhookConfigured,
    missingCheckoutKeys,
    missingWebhookKeys,
    mode,
    safeSummary,
  };
}

/**
 * Returns the Stripe price ID for a given purchase type and billing interval.
 * Returns null if the env var is not set.
 */
export function getPriceId(
  purchaseType: PurchaseType,
  billingInterval: BillingInterval
): string | null {
  const key =
    purchaseType === "solo"
      ? billingInterval === "monthly"
        ? STRIPE_ENV_KEYS.soloMonthlyPriceId
        : STRIPE_ENV_KEYS.soloAnnualPriceId
      : billingInterval === "monthly"
        ? STRIPE_ENV_KEYS.communityMonthlyPriceId
        : STRIPE_ENV_KEYS.communityAnnualPriceId;
  const val = process.env[key];
  return val && val.trim() ? val : null;
}

/**
 * Maps a Stripe price ID back to an internal UserPlan.
 * Both Solo and Communities prices → PRO (full access).
 * Returns null for unrecognized price IDs (e.g. CALENDAR_ONLY has no price).
 */
export function priceIdToPlan(priceId: string): UserPlan | null {
  const soloMonthly = process.env[STRIPE_ENV_KEYS.soloMonthlyPriceId];
  const soloAnnual = process.env[STRIPE_ENV_KEYS.soloAnnualPriceId];
  const communityMonthly = process.env[STRIPE_ENV_KEYS.communityMonthlyPriceId];
  const communityAnnual = process.env[STRIPE_ENV_KEYS.communityAnnualPriceId];

  if (
    priceId === soloMonthly ||
    priceId === soloAnnual ||
    priceId === communityMonthly ||
    priceId === communityAnnual
  ) {
    return "PRO";
  }
  return null;
}

/**
 * Maps an internal UserPlan to a default Stripe price ID.
 * PRO → Solo Monthly (default paid product).
 * CALENDAR_ONLY → null (internal/admin-assigned, not purchasable).
 */
export function planToPriceId(plan: UserPlan): string | null {
  if (plan === "CALENDAR_ONLY") return null;
  return getPriceId("solo", "monthly");
}
