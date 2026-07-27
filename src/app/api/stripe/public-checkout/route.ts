import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getStripe, getAppUrl } from "@/lib/stripe";
import { getPriceId, isStripeCheckoutConfigured } from "@/lib/stripe-config";
import type { PurchaseType, BillingInterval } from "@/lib/pricing";
import { COMMUNITY_MIN_SEATS, COMMUNITY_MAX_SEATS } from "@/lib/pricing";
import { buildTrialSubscriptionData } from "@/lib/trial";
import { checkActionRateLimit } from "@/lib/rate-limiter";

/**
 * Public Stripe Checkout — no authentication required.
 *
 * This route is used by the public marketing homepage to allow visitors
 * to purchase Solo or Communities memberships without an existing account.
 *
 * The server maps purchaseType + billingInterval to the correct Stripe
 * price ID. The client never sends a price ID directly.
 *
 * Metadata includes `checkoutSource: "public_homepage"` so the webhook
 * handler can branch into public checkout fulfillment logic.
 */
export async function POST(request: Request) {
  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      { error: "Checkout is not configured. Please try again later." },
      { status: 503 }
    );
  }

  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  const rateLimit = await checkActionRateLimit(
    `public_checkout:${clientIp}`,
    5,
    10 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Please try again later." },
      { status: 429 }
    );
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

  const purchaseType = body.purchaseType as PurchaseType;
  const billingInterval = body.billingInterval as BillingInterval;

  if (purchaseType !== "solo" && purchaseType !== "community") {
    return NextResponse.json(
      { error: "Invalid purchase type. Must be 'solo' or 'community'." },
      { status: 400 }
    );
  }

  if (billingInterval !== "monthly" && billingInterval !== "annual") {
    return NextResponse.json(
      { error: "Invalid billing interval. Must be 'monthly' or 'annual'." },
      { status: 400 }
    );
  }

  let seats = 1;
  if (purchaseType === "community") {
    seats = Number(body.seats);
    if (!Number.isInteger(seats) || seats < COMMUNITY_MIN_SEATS || seats > COMMUNITY_MAX_SEATS) {
      return NextResponse.json(
        { error: `Communities membership requires ${COMMUNITY_MIN_SEATS}–${COMMUNITY_MAX_SEATS} seats.` },
        { status: 400 }
      );
    }

    const organizationName = body.organizationName?.trim();
    if (!organizationName || organizationName.length < 2) {
      return NextResponse.json(
        { error: "Organization name is required (min 2 characters)." },
        { status: 400 }
      );
    }
  }

  const priceId = getPriceId(purchaseType, billingInterval);
  if (!priceId) {
    return NextResponse.json(
      { error: "Pricing is not configured for this option. Please try again later." },
      { status: 503 }
    );
  }

  const appUrl = getAppUrl();
  const organizationName = body.organizationName?.trim();

  const trialEligible = true;

  const metadata: Record<string, string> = {
    checkoutSource: "public_homepage",
    purchaseType,
    billingInterval,
    seats: String(seats),
    appPlan: "PRO",
    ...(trialEligible ? { trialGranted: "true" } : {}),
    ...(organizationName ? { organizationName } : {}),
  };

  try {
    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: seats }],
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?checkout=cancelled#pricing`,
      subscription_data: {
        metadata,
        ...buildTrialSubscriptionData(trialEligible),
      },
      metadata,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error("[PUBLIC CHECKOUT] Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to start checkout. Please try again." },
      { status: 500 }
    );
  }
}
