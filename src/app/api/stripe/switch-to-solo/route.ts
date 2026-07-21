import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getAppUrl } from "@/lib/stripe";
import { getPriceId, isStripeCheckoutConfigured } from "@/lib/stripe-config";
import type { BillingInterval } from "@/lib/stripe-config";

/**
 * Switch a TEAM_ADMIN from Community to Solo membership.
 *
 * This route ONLY creates a Solo checkout session with switchFromOrgId metadata.
 * No org cancellation or admin transfer happens here — those are deferred to the
 * checkout.session.completed webhook (processSwitchFromCommunity) so that if the
 * user abandons checkout, the community is left untouched.
 *
 * After solo checkout is completed via webhook:
 * 1. Org subscription is scheduled to cancel at period end
 * 2. TEAM_ADMIN role is transferred to the oldest active member (if any)
 * 3. The original admin is removed from the org
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured." },
      { status: 500 }
    );
  }

  let body: { billingInterval?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const billingInterval = body.billingInterval as BillingInterval;
  if (billingInterval !== "monthly" && billingInterval !== "annual") {
    return NextResponse.json(
      { error: "billingInterval must be 'monthly' or 'annual'." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      stripeCustomerId: true,
      organizationId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "TEAM_ADMIN" || !user.organizationId) {
    return NextResponse.json(
      { error: "Only a community admin can switch to solo." },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { id: true, name: true, stripeSubscriptionId: true, seatPlan: true },
  });

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found." },
      { status: 404 }
    );
  }

  const stripe = getStripe();

  // Create Solo checkout session with switchFromOrgId metadata.
   // No org changes happen here — they are deferred to the webhook.
  const priceId = getPriceId("solo", billingInterval);
  if (!priceId) {
    return NextResponse.json(
      { error: "Solo price not configured." },
      { status: 500 }
    );
  }

  const appUrl = getAppUrl();
  const metadata = {
    userId: user.id,
    purchaseType: "solo",
    billingInterval,
    seats: "1",
    appPlan: "PRO",
    switchFromOrgId: org.id,
  };

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      client_reference_id: user.id,
      customer_email: user.stripeCustomerId ? undefined : (user.email ?? undefined),
      customer: user.stripeCustomerId ?? undefined,
      subscription_data: { metadata },
      metadata,
      allow_promotion_codes: true,
    });
    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[SWITCH TO SOLO] Failed to create checkout session:", error);
    return NextResponse.json(
      { error: "Failed to start solo checkout. Your community has not been modified." },
      { status: 500 }
    );
  }
}
