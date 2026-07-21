import Stripe from "stripe";
import type { UserPlan } from "@/lib/tiers";
import {
  isStripeCheckoutConfigured,
  priceIdToPlan as priceIdToPlanConfig,
  planToPriceId as planToPriceIdConfig,
} from "@/lib/stripe-config";

/**
 * Stripe client — singleton.
 * Uses STRIPE_SECRET_KEY from env. Must be server-side only.
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-06-24.dahlia",
      typescript: true,
    });
  }
  return stripeInstance;
}

/** Re-export config checks from stripe-config.ts for backward compatibility */
export { isStripeCheckoutConfigured, isStripeWebhookConfigured, isStripeFullyConfigured } from "@/lib/stripe-config";
export { getStripeConfigStatus, getPriceId, STRIPE_ENV_KEYS } from "@/lib/stripe-config";
export type { PurchaseType, BillingInterval, StripeConfigStatus } from "@/lib/stripe-config";

/** Whether Stripe checkout is configured (secret key + all price IDs + app URL) */
export const isStripeConfigured = isStripeCheckoutConfigured;

/** Reverse lookup: Stripe price ID → UserPlan (both Solo and Community prices → PRO) */
export function priceIdToPlan(priceId: string): UserPlan | null {
  return priceIdToPlanConfig(priceId);
}

/** Forward lookup: UserPlan → default Stripe price ID (PRO → Solo Monthly) */
export function planToPriceId(plan: UserPlan): string | null {
  return planToPriceIdConfig(plan);
}

/**
 * Map Stripe subscription status → our AccountStatus enum values.
 */
export function stripeStatusToAccountStatus(
  status: Stripe.Subscription.Status
): "ACTIVE" | "TRIAL" | "PAST_DUE" | "CANCELED" | "EXPIRED" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIAL";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
      return "CANCELED";
    case "incomplete_expired":
      return "EXPIRED";
    default:
      return "ACTIVE";
  }
}

/**
 * Determine the plan from a Stripe Subscription's items.
 * Checks the first item's price ID against our mapping.
 */
export function planFromSubscription(sub: Stripe.Subscription): UserPlan {
  const item = sub.items.data[0];
  if (!item) return "PRO";
  const plan = priceIdToPlan(item.price.id);
  return plan ?? "PRO";
}

/**
 * App URL helper — used for success/cancel redirect URLs.
 */
export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
