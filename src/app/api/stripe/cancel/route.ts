import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

/**
 * Cancel subscription at period end.
 * The user keeps access until the current billing period ends.
 * When the period ends, Stripe fires customer.subscription.deleted,
 * which sets accountStatus to ARCHIVED. Data is preserved.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      organizationId: true,
      role: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Determine the subscription to cancel — org's (for community members) or
  // user's own (for solo subscribers).
  //
  // For community members, the subscription lives on the Organization. We
  // check the org FIRST so that stale user-level Stripe fields (left over
  // from the pre-Finding-3 bug where registerWithToken/assignTeamAdmin copied
  // org fields onto the User) don't cause us to update the wrong record.
  let subscriptionId: string | null = null;
  let isOrgSubscription = false;

  if (user.organizationId) {
    // Only TEAM_ADMIN can cancel the community/org subscription
    if (user.role !== "TEAM_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Only the community admin can cancel the community subscription. Please contact your admin.",
        },
        { status: 403 }
      );
    }
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeSubscriptionId: true },
    });
    subscriptionId = org?.stripeSubscriptionId ?? null;
    isOrgSubscription = !!subscriptionId;
  }

  // Fall back to user-level subscription for solo subscribers
  if (!subscriptionId && !user.organizationId) {
    subscriptionId = user.stripeSubscriptionId;
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  try {
    // Cancel at period end — user keeps access until the period finishes
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    const currentPeriodEnd = updatedSubscription.items.data[0]?.current_period_end;
    const stripeCurrentPeriodEnd = currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000)
      : null;
    const stripeCancelAt = updatedSubscription.cancel_at
      ? new Date(updatedSubscription.cancel_at * 1000)
      : stripeCurrentPeriodEnd;

    // Update local status so UI can show "cancellation scheduled"
    if (isOrgSubscription) {
      // Org subscription
      await prisma.organization.update({
        where: { id: user.organizationId! },
        data: {
          stripeStatus: "cancel_at_period_end",
          stripeCancelAt,
          stripeCurrentPeriodEnd,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeStatus: "cancel_at_period_end",
          stripeCancelAt,
          stripeCurrentPeriodEnd,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Subscription scheduled to cancel at the end of the current billing period.",
    });
  } catch (error) {
    console.error("[STRIPE CANCEL] Failed to cancel subscription:", error);
    return NextResponse.json(
      { error: "Failed to cancel subscription. Please try again." },
      { status: 500 }
    );
  }
}
