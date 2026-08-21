import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { severZernioForUser } from "@/lib/zernio-sever";
import { getStripe, stripeStatusToAccountStatus } from "@/lib/stripe";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Safety-net cron for missed Stripe webhooks.
 *
 * 1. Finds ARCHIVED users who still have ZernioAccount rows (missed
 *    customer.subscription.deleted webhook) and severs them.
 * 2. Finds TRIAL users whose trialEndsAt has passed and who no longer
 *    have an active Stripe subscription — archives and severs them.
 *
 * Run hourly via external cron (e.g. Vercel Cron, Railway, etc.):
 *   GET /api/cron/billing with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = { severedArchived: 0, expiredTrials: 0, syncedTrials: 0 };

  // 1. Sever Zernio accounts for ARCHIVED users who still have connections
  const archivedWithZernio = await prisma.user.findMany({
    where: {
      accountStatus: "ARCHIVED",
      zernioAccounts: { some: {} },
    },
    select: { id: true },
  });

  for (const user of archivedWithZernio) {
    await severZernioForUser(user.id);
    results.severedArchived++;
  }

  if (results.severedArchived > 0) {
    console.log(`[CRON BILLING] Severed Zernio for ${results.severedArchived} archived users`);
  }

  // 2. Find TRIAL users whose trial has expired and subscription is gone
  const expiredTrials = await prisma.user.findMany({
    where: {
      accountStatus: "TRIAL",
      trialEndsAt: { lt: new Date() },
      stripeSubscriptionId: null,
      role: { not: "ADMIN" },
      isComped: false,
    },
    select: { id: true },
  });

  for (const user of expiredTrials) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        accountStatus: "ARCHIVED",
        plan: "CALENDAR_ONLY",
        stripeStatus: "canceled",
        trialEndsAt: null,
      },
    });
    await severZernioForUser(user.id);
    results.expiredTrials++;
  }

  if (results.expiredTrials > 0) {
    console.log(`[CRON BILLING] Archived ${results.expiredTrials} expired trial users`);
  }

  // 3. Sync TRIAL users whose trial has ended but still have an active subscription
  //    (missed customer.subscription.updated webhook for trial→active transition)
  const staleTrials = await prisma.user.findMany({
    where: {
      accountStatus: "TRIAL",
      trialEndsAt: { lt: new Date() },
      stripeSubscriptionId: { not: null },
      role: { not: "ADMIN" },
      isComped: false,
    },
    select: { id: true, stripeSubscriptionId: true },
  });

  const stripe = getStripe();
  for (const user of staleTrials) {
    try {
      const sub = await stripe.subscriptions.retrieve(user.stripeSubscriptionId!);
      const currentPeriodEnd = sub.items.data[0]?.current_period_end;
      const stripeCurrentPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null;
      const stripeCancelAt = sub.cancel_at
        ? new Date(sub.cancel_at * 1000)
        : sub.cancel_at_period_end
          ? stripeCurrentPeriodEnd
          : null;

      if (sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired") {
        // Subscription is dead — full downgrade (same as handleSubscriptionDeleted)
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountStatus: "ARCHIVED",
            plan: "CALENDAR_ONLY",
            stripeStatus: sub.status,
            stripeSubscriptionId: null,
            stripeCustomerId: null,
            stripeCancelAt: null,
            stripeCurrentPeriodEnd: null,
            hasUsedTrial: true, // Trial is consumed — prevent repeat trials
            trialEndsAt: null,
          },
        });
        await severZernioForUser(user.id);
        console.log(`[CRON BILLING] Full downgrade for user ${user.id} — subscription ${sub.status}`);
      } else {
        // Subscription is active/trialing — sync status
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountStatus: stripeStatusToAccountStatus(sub.status),
            stripeStatus: sub.cancel_at_period_end || sub.cancel_at
              ? "cancel_at_period_end"
              : sub.status,
            stripeCancelAt,
            stripeCurrentPeriodEnd,
            hasUsedTrial: true, // Trial is consumed — prevent repeat trials
            trialEndsAt: null,
          },
        });
      }
      results.syncedTrials++;
    } catch (err) {
      console.error(`[CRON BILLING] Failed to sync stale trial for user ${user.id}:`, err);
    }
  }

  if (results.syncedTrials > 0) {
    console.log(`[CRON BILLING] Synced ${results.syncedTrials} stale trial users to active`);
  }

  return NextResponse.json({ ok: true, ...results });
}
