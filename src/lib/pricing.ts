/**
 * Isomorphic pricing utilities — safe for both client and server.
 * No process.env access, no server-only imports.
 */

export type BillingInterval = "monthly" | "annual";
export type PurchaseType = "solo" | "community";

export const COMMUNITY_MONTHLY_TIERS = [
  { upTo: 1, perSeatCents: 20000 }, // Seat 1: $200
  { upTo: 4, perSeatCents: 15000 }, // Seats 2–4: $150 each
  { upTo: 9, perSeatCents: 13000 }, // Seats 5–9: $130 each
  { upTo: Infinity, perSeatCents: 11000 }, // Seats 10+: $110 each
] as const;

export const SOLO_MONTHLY_CENTS = 20000; // $200/mo
export const SOLO_ANNUAL_CENTS = 199900; // $1,999/yr
export const COMMUNITY_MIN_SEATS = 2;
export const COMMUNITY_MAX_SEATS = 25;

/**
 * Calculate total monthly cost for a community plan with N seats.
 * Returns amount in cents.
 */
export function calculateCommunityMonthlyTotal(seats: number): number {
  if (seats < 1) return 0;
  let total = 0;
  let remaining = seats;
  let prevUpTo = 0;
  for (const tier of COMMUNITY_MONTHLY_TIERS) {
    const seatsInTier = Math.min(remaining, tier.upTo - prevUpTo);
    if (seatsInTier <= 0) break;
    total += seatsInTier * tier.perSeatCents;
    remaining -= seatsInTier;
    prevUpTo = tier.upTo;
    if (remaining <= 0) break;
  }
  return total;
}

/**
 * Calculate total annual cost for a community plan with N seats.
 * Annual = monthly × 10 (per PAYMENT_SYSTEM.md).
 * Returns amount in cents.
 */
export function calculateCommunityAnnualTotal(seats: number): number {
  return calculateCommunityMonthlyTotal(seats) * 10;
}

/**
 * Calculate total cost for a community plan based on billing interval.
 * Returns amount in cents.
 */
export function calculateCommunityTotal(
  seats: number,
  interval: BillingInterval
): number {
  return interval === "annual"
    ? calculateCommunityAnnualTotal(seats)
    : calculateCommunityMonthlyTotal(seats);
}

/** Convert cents to dollars for display. */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/** Format cents as a USD currency string (e.g. $780). */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export interface TierBreakdownRow {
  label: string;
  count: number;
  perSeatCents: number;
  subtotalCents: number;
}

/**
 * Returns a per-tier breakdown for display purposes.
 * Example for 5 seats:
 *   Seat 1:       1 × $200 = $200
 *   Seats 2–4:    3 × $150 = $450
 *   Seat 5:       1 × $130 = $130
 *   Total: $780/month
 */
export function getTierBreakdown(seats: number): TierBreakdownRow[] {
  if (seats < 1) return [];
  const rows: TierBreakdownRow[] = [];
  let remaining = seats;
  let prevUpTo = 0;
  let tierIndex = 0;

  for (const tier of COMMUNITY_MONTHLY_TIERS) {
    const seatsInTier = Math.min(remaining, tier.upTo - prevUpTo);
    if (seatsInTier <= 0) break;

    const tierStart = prevUpTo + 1;
    const tierEnd = prevUpTo + seatsInTier;
    const label =
      seatsInTier === 1
        ? `Seat ${tierStart}`
        : tierEnd === tier.upTo
          ? `Seats ${tierStart}–${tierEnd}`
          : `Seat ${tierStart}`;

    rows.push({
      label,
      count: seatsInTier,
      perSeatCents: tier.perSeatCents,
      subtotalCents: seatsInTier * tier.perSeatCents,
    });

    remaining -= seatsInTier;
    prevUpTo = tier.upTo;
    tierIndex++;
    if (remaining <= 0) break;
  }

  return rows;
}
