"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, priceIdToPlan } from "@/lib/stripe";
import type Stripe from "stripe";

const MONTHS_OF_HISTORY = 12;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export interface MonthlyRevenue {
  /** ISO month key, e.g. "2026-07" */
  monthKey: string;
  /** Display label, e.g. "Jul 2026" */
  monthLabel: string;
  /** Total collected revenue in cents (excluding comped users). */
  totalCents: number;
  /** Number of paid invoices counted. */
  invoiceCount: number;
  /** Average invoice amount in cents. */
  avgInvoiceCents: number;
}

export interface MrrSummary {
  /** Current MRR in cents (excluding comped users). */
  mrrCents: number;
  /** Number of active subscriptions counted. */
  activeSubCount: number;
  /** Count of monthly-billed subscriptions. */
  monthlySubs: number;
  /** Count of annual-billed subscriptions. */
  annualSubs: number;
}

export interface RevenueData {
  monthly: MonthlyRevenue[];
  mrr: MrrSummary;
  /** ISO timestamp of when the data was fetched. */
  generatedAt: string;
}

interface CachedRevenue {
  data: RevenueData;
  fetchedAt: number;
}

let revenueCache: CachedRevenue | null = null;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Start of the given month at 00:00:00 local time. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

/** Start of the month N months before the given date. */
function startOfMonthNMonthsAgo(ref: Date, n: number): Date {
  return new Date(ref.getFullYear(), ref.getMonth() - n, 1, 0, 0, 0, 0);
}

/**
 * Fetch all paid invoices created within [start, end) using pagination.
 * Returns the raw Stripe invoice objects (only the fields we read).
 */
async function fetchPaidInvoicesForMonth(
  stripe: ReturnType<typeof getStripe>,
  start: Date,
  end: Date
): Promise<Stripe.Invoice[]> {
  const invoices: Stripe.Invoice[] = [];
  let startingAfter: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.invoices.list({
      status: "paid",
      created: { gte: Math.floor(start.getTime() / 1000), lt: Math.floor(end.getTime() / 1000) },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    invoices.push(...page.data);

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return invoices;
}

/**
 * Check whether an invoice is for one of our app subscription products.
 * Matches if any line item's price ID maps to a known app plan via priceIdToPlan.
 * One-off charges (e.g. custom $1,000 invoices) have no matching price and are excluded.
 */
function isAppSubscriptionInvoice(inv: Stripe.Invoice): boolean {
  const lines = inv.lines?.data ?? [];
  for (const line of lines) {
    // API 2026-06-24.dahlia: price ID lives at line.pricing.price_details.price
    const priceRef = line.pricing?.price_details?.price;
    const priceId = typeof priceRef === "string" ? priceRef : priceRef?.id;
    if (priceId && priceIdToPlan(priceId) !== null) return true;
  }
  return false;
}

/** Sum collected revenue for a month, excluding comped/trialing customers and non-app charges. */
function sumMonthRevenue(
  invoices: Stripe.Invoice[],
  excludedCustomerIds: Set<string>
): { totalCents: number; invoiceCount: number } {
  let totalCents = 0;
  let invoiceCount = 0;

  for (const inv of invoices) {
    // Skip one-time / non-subscription charges (e.g. custom $1,000 invoices).
    if (!isAppSubscriptionInvoice(inv)) continue;

    const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id ?? null;
    if (customerId && excludedCustomerIds.has(customerId)) continue;

    totalCents += inv.total ?? 0;
    invoiceCount += 1;
  }

  return { totalCents, invoiceCount };
}

/**
 * Compute current MRR from active subscriptions, excluding comped/trialing customers.
 * Monthly subs contribute their full amount; annual subs contribute amount / 12.
 */
async function computeMrr(
  stripe: ReturnType<typeof getStripe>,
  excludedCustomerIds: Set<string>
): Promise<MrrSummary> {
  let mrrCents = 0;
  let activeSubCount = 0;
  let monthlySubs = 0;
  let annualSubs = 0;

  let startingAfter: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await stripe.subscriptions.list({
      status: "active",
      limit: 100,
      expand: ["data.customer"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const sub of page.data) {
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;
      if (customerId && excludedCustomerIds.has(customerId)) continue;

      const item = sub.items.data[0];
      const price = item?.price;
      const interval = price?.recurring?.interval;
      const amount = price?.unit_amount ?? 0;
      const quantity = item?.quantity ?? 1;
      const lineCents = amount * quantity;

      if (interval === "month") {
        mrrCents += lineCents;
        monthlySubs += 1;
      } else if (interval === "year") {
        mrrCents += Math.round(lineCents / 12);
        annualSubs += 1;
      } else {
        // Unknown interval — skip to avoid skewing MRR.
        continue;
      }

      activeSubCount += 1;
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return { mrrCents, activeSubCount, monthlySubs, annualSubs };
}

export async function getRevenueData(): Promise<RevenueData | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  // Serve from cache if fresh.
  if (revenueCache && Date.now() - revenueCache.fetchedAt < CACHE_TTL_MS) {
    return revenueCache.data;
  }

  try {
    const stripe = getStripe();

    // Pull excluded customers: comped users + users still in trial.
    // Trial customers haven't started paying — their invoices are $0 trial
    // invoices or charges that get reversed by credit memos.
    const [compedUsers, trialingUsers] = await Promise.all([
      prisma.user.findMany({
        where: { isComped: true, stripeCustomerId: { not: null } },
        select: { stripeCustomerId: true },
      }),
      prisma.user.findMany({
        where: { stripeStatus: "trialing", stripeCustomerId: { not: null } },
        select: { stripeCustomerId: true },
      }),
    ]);
    const excludedCustomerIds = new Set<string>(
      [...compedUsers, ...trialingUsers]
        .map((u) => u.stripeCustomerId)
        .filter((c): c is string => Boolean(c))
    );

    // Build the last 12 calendar months (including the current month).
    const now = new Date();
    const months: { start: Date; end: Date }[] = [];
    for (let i = MONTHS_OF_HISTORY - 1; i >= 0; i--) {
      const start = startOfMonthNMonthsAgo(now, i);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
      months.push({ start, end });
    }

    // Fetch invoices for each month in parallel.
    const monthInvoices = await Promise.all(
      months.map((m) => fetchPaidInvoicesForMonth(stripe, m.start, m.end))
    );

    const monthly: MonthlyRevenue[] = months.map((m, idx) => {
      const { totalCents, invoiceCount } = sumMonthRevenue(monthInvoices[idx], excludedCustomerIds);
      return {
        monthKey: monthKey(m.start),
        monthLabel: monthLabel(m.start),
        totalCents,
        invoiceCount,
        avgInvoiceCents: invoiceCount > 0 ? Math.round(totalCents / invoiceCount) : 0,
      };
    });

    const mrr = await computeMrr(stripe, excludedCustomerIds);

    const data: RevenueData = {
      monthly,
      mrr,
      generatedAt: new Date().toISOString(),
    };

    revenueCache = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    console.error("[REVENUE] Failed to fetch revenue data:", error);
    return { error: "Failed to load revenue data from Stripe" };
  }
}
