import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getAppUrl } from "@/lib/stripe";
import { getPriceId, isStripeCheckoutConfigured } from "@/lib/stripe-config";
import type { PurchaseType, BillingInterval } from "@/lib/stripe-config";

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
  if (body.purchaseType !== "solo" && body.purchaseType !== "community") {
    return NextResponse.json(
      { error: "purchaseType is required and must be 'solo' or 'community'." },
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

  const purchaseType = body.purchaseType as PurchaseType;
  const billingInterval = body.billingInterval as BillingInterval;
  let seats = 1;
  let organizationName: string | undefined;

  if (purchaseType === "solo") {
    // Solo: always quantity 1, ignore seats/orgName
    seats = 1;
  } else {
    // Community: require seats >= 2 and organizationName
    const rawSeats = Math.floor(body.seats ?? 0);
    if (!Number.isInteger(rawSeats) || rawSeats < 2) {
      return NextResponse.json(
        { error: "seats is required for community and must be an integer >= 2." },
        { status: 400 }
      );
    }
    seats = rawSeats;

    const orgName = body.organizationName?.trim();
    if (!orgName) {
      return NextResponse.json(
        { error: "organizationName is required for community checkout." },
        { status: 400 }
      );
    }
    organizationName = orgName;
  }

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
    select: { id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, plan: true, accountStatus: true, isComped: true },
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

  const stripe = getStripe();
  const appUrl = getAppUrl();

  const metadata = {
    userId: user.id,
    purchaseType,
    billingInterval,
    seats: String(seats),
    appPlan: "PRO",
    ...(organizationName ? { organizationName } : {}),
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
