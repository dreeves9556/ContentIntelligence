import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";

/**
 * Update seat quantity for an existing Communities subscription.
 *
 * Request body:
 *   { action: "add" | "remove", newQuantity: number }
 *
 * - "add": Updates Stripe subscription quantity with default proration (charges
 *   a prorated amount immediately). New seat is available instantly.
 * - "remove": Updates Stripe subscription quantity with proration_behavior:
 *   "none". The seat reduction takes effect at the next billing period.
 *
 * Authorization: The caller must be the TEAM_ADMIN (or ADMIN) of the org
 * associated with the Stripe subscription. The subscription ID is read from
 * the database (not from the client) to prevent cross-org tampering.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeCheckoutConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 }
    );
  }

  let body: { action?: string; newQuantity?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.action !== "add" && body.action !== "remove") {
    return NextResponse.json(
      { error: "action must be 'add' or 'remove'." },
      { status: 400 }
    );
  }

  const newQuantity = Math.floor(body.newQuantity ?? 0);
  if (!Number.isInteger(newQuantity) || newQuantity < 2) {
    return NextResponse.json(
      { error: "newQuantity must be an integer >= 2 (minimum for Communities)." },
      { status: 400 }
    );
  }

  if (newQuantity > 25) {
    return NextResponse.json(
      { error: "Maximum 25 seats. Contact support for larger teams." },
      { status: 400 }
    );
  }

  // Load the user and their org
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      organizationId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.role !== "TEAM_ADMIN" && user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only team admins can manage seats." },
      { status: 403 }
    );
  }

  if (!user.organizationId) {
    return NextResponse.json(
      { error: "You don't have an organization." },
      { status: 400 }
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { id: true, seatLimit: true, stripeSubscriptionId: true, name: true },
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found." }, { status: 404 });
  }

  if (!org.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No Stripe subscription found for this organization." },
      { status: 400 }
    );
  }

  const currentQuantity = org.seatLimit;

  if (body.action === "add" && newQuantity <= currentQuantity) {
    return NextResponse.json(
      { error: "New quantity must be greater than current seat count to add seats." },
      { status: 400 }
    );
  }

  if (body.action === "remove" && newQuantity >= currentQuantity) {
    return NextResponse.json(
      { error: "New quantity must be less than current seat count to remove seats." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  try {
    // Retrieve the subscription to find the item ID
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;

    if (!itemId) {
      return NextResponse.json(
        { error: "Could not find subscription item to update." },
        { status: 500 }
      );
    }

    await stripe.subscriptions.update(org.stripeSubscriptionId, {
      items: [{ id: itemId, quantity: newQuantity }],
      proration_behavior: body.action === "add" ? "create_prorations" : "none",
      metadata: {
        purchaseType: "community",
        seatUpdate: `${body.action}:${currentQuantity}->${newQuantity}`,
      },
    });

    // Update org seatLimit locally (the webhook will also update this, but we
    // do it now for immediate UI feedback)
    await prisma.organization.update({
      where: { id: org.id },
      data: { seatLimit: newQuantity },
    });

    console.log(
      `[STRIPE UPDATE-SEATS] Org ${org.id} (${org.name}) — ${body.action} ${Math.abs(newQuantity - currentQuantity)} seat(s): ${currentQuantity} → ${newQuantity}`
    );

    return NextResponse.json({
      success: true,
      newQuantity,
      action: body.action,
    });
  } catch (error) {
    console.error("[STRIPE UPDATE-SEATS] Failed:", error);
    return NextResponse.json(
      { error: "Failed to update seat quantity with Stripe." },
      { status: 500 }
    );
  }
}
