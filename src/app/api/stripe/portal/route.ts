import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe, getAppUrl } from "@/lib/stripe";

/**
 * Cached portal configuration ID — created once, reused for all portal sessions.
 * Disables subscription_update so users cannot change seat quantities via the
 * Stripe portal (which would bypass the seat reconciliation flow).
 */
let cachedPortalConfigId: string | null = null;

async function getPortalConfigId(stripe: ReturnType<typeof getStripe>): Promise<string> {
  if (cachedPortalConfigId) return cachedPortalConfigId;

  // Look for an existing configuration that's active
  const configs = await stripe.billingPortal.configurations.list({ limit: 100 });
  const existing = configs.data.find(
    (c) => c.active && c.features?.subscription_update?.enabled === false
  );

  if (existing) {
    cachedPortalConfigId = existing.id;
    return cachedPortalConfigId;
  }

  // Create a new configuration with subscription_update disabled
  const config = await stripe.billingPortal.configurations.create({
    features: {
      subscription_update: { enabled: false },
      subscription_cancel: { enabled: true, mode: "at_period_end" },
      payment_method_update: { enabled: true },
      invoice_history: { enabled: true },
    },
  });

  cachedPortalConfigId = config.id;
  return cachedPortalConfigId;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No active subscription found. Upgrade first to manage billing." },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const appUrl = getAppUrl();

  try {
    const portalConfigId = await getPortalConfigId(stripe);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
      configuration: portalConfigId,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error("[STRIPE PORTAL] Failed to create portal session:", error);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
