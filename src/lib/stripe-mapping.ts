import type { UserPlan } from "@/lib/tiers";

/**
 * Placeholder mapping helpers for future Stripe integration.
 *
 * These will be used by Stripe webhook handlers to translate Stripe
 * subscription metadata into Organization fields:
 *
 * - Stripe subscription purchased  → create/update Organization
 * - Stripe quantity (seats)        → Organization.seatLimit
 * - Stripe price/product            → Organization.seatPlan
 * - Stripe customer                 → Organization.stripeCustomerId
 * - Subscription status             → Organization.stripeStatus
 *
 * No Stripe env vars or SDK are required yet.
 */

/**
 * Map a Stripe Price ID to a UserPlan.
 *
 * Future: read from env (e.g. STRIPE_PRICE_CALENDAR_ONLY,
 * STRIPE_PRICE_PRO) or a DB-backed price→plan lookup table.
 * For now returns a default so the helper is callable without configuration.
 */
export function mapStripePriceToUserPlan(priceId: string): UserPlan {
  const envMap: Record<string, UserPlan> = {
    [process.env.STRIPE_PRICE_CALENDAR_ONLY ?? "__unused_calendar__"]: "CALENDAR_ONLY",
    [process.env.STRIPE_PRICE_PRO ?? "__unused_pro__"]: "PRO",
  };

  return envMap[priceId] ?? "PRO";
}

/**
 * Map a Stripe subscription quantity to a seat limit.
 * Ensures a minimum of 1 seat.
 */
export function mapStripeQuantityToSeatLimit(quantity: number): number {
  if (!Number.isFinite(quantity) || quantity < 1) return 1;
  return Math.floor(quantity);
}
