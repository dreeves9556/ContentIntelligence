import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getAppUrl } from "@/lib/stripe";
import { getPriceId, isStripeCheckoutConfigured } from "@/lib/stripe-config";
import type { BillingInterval } from "@/lib/stripe-config";
import { isTrialEligible, buildTrialSubscriptionData } from "@/lib/trial";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    purchaseType?: string;
    billingInterval?: string;
    seats?: number;
    organizationName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      { error: "Stripe checkout is not configured. Check server environment variables." },
      { status: 500 }
    );
  }

  // Validate purchaseType
  if (body.purchaseType === "community") {
    return NextResponse.json(
      { error: "Communities plans are arranged directly with our team." },
      { status: 410 }
    );
  }
  if (body.purchaseType !== "solo") {
    return NextResponse.json(
      { error: "purchaseType is required and must be 'solo'." },
      { status: 400 }
    );
  }

  // Validate billingInterval
  if (body.billingInterval !== "monthly" && body.billingInterval !== "annual") {
    return NextResponse.json(
      { error: "billingInterval is required and must be 'monthly' or 'annual'." },
      { status: 400 }
    );
  }

  const purchaseType = "solo" as const;
  const billingInterval = body.billingInterval as BillingInterval;
  const seats = 1;

  // Server maps purchase type/interval to env price IDs — client cannot send arbitrary price IDs
  const priceId = getPriceId(purchaseType, billingInterval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price for ${purchaseType} ${billingInterval} is not configured.` },
      { status: 500 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, plan: true, accountStatus: true, isComped: true, hasUsedTrial: true, role: true, organizationId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Block re-purchase for users who already have an active subscription
  if (
    !user.isComped &&
    user.plan === "PRO" &&
    user.accountStatus === "ACTIVE" &&
    user.stripeSubscriptionId
  ) {
    return NextResponse.json(
      { error: "You already have an active subscription. Use the billing portal to manage it." },
      { status: 400 }
    );
  }

  // Block re-purchase for TEAM_ADMINs whose organization already has an
  // active subscription. The user-level guard above only checks
  // User.stripeSubscriptionId, which is null for community members (the
  // subscription lives on the Organization). Without this check, a TEAM_ADMIN
  // with an active org subscription could start a duplicate checkout.
  if (user.role === "TEAM_ADMIN" && user.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { stripeSubscriptionId: true },
    });
    if (org?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Your community already has an active subscription. Use the billing portal to manage it." },
        { status: 400 }
      );
    }
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const trialEligible = isTrialEligible(user);

  const metadata = {
    userId: user.id,
    purchaseType,
    billingInterval,
    seats: String(seats),
    appPlan: "PRO",
    ...(trialEligible ? { trialGranted: "true" } : {}),
  };

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: seats }],
      success_url: `${appUrl}/dashboard/billing?success=1`,
      cancel_url: `${appUrl}/dashboard/billing?canceled=1`,
      client_reference_id: user.id,
      customer_email: user.stripeCustomerId ? undefined : (user.email ?? undefined),
      customer: user.stripeCustomerId ?? undefined,
      subscription_data: {
        metadata,
        ...buildTrialSubscriptionData(trialEligible),
      },
      metadata,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[STRIPE CHECKOUT] Failed to create session:", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
