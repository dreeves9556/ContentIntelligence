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

  // Determine the subscription to cancel — user's own or org's
  let subscriptionId = user.stripeSubscriptionId;
  let isOrgSubscription = false;

  if (!subscriptionId && user.organizationId) {
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

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "No active subscription found." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  try {
    // Cancel at period end — user keeps access until the period finishes
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update local status so UI can show "cancellation scheduled"
    if (isOrgSubscription) {
      // Org subscription
      await prisma.organization.update({
        where: { stripeSubscriptionId: subscriptionId },
        data: { stripeStatus: "cancel_at_period_end" },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeStatus: "cancel_at_period_end" },
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
