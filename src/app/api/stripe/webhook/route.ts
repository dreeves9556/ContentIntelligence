import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { randomBytes, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { getStripe, stripeStatusToAccountStatus } from "@/lib/stripe";
import { isStripeWebhookConfigured } from "@/lib/stripe-config";
import { prisma } from "@/lib/prisma";
import { sendPaidMembershipRegistrationEmail } from "@/lib/paid-registration-email";

/**
 * Stripe webhook handler.
 *
 * Fulfillment is driven by checkout metadata (purchaseType: "solo" | "community")
 * and subscription item price IDs. Both paid products map to PRO internally.
 *
 * Events handled:
 * - checkout.session.completed → fulfill Solo (user PRO) or Community (org + TEAM_ADMIN)
 * - customer.subscription.updated → sync status for user or org
 * - customer.subscription.deleted → downgrade user or org members to CALENDAR_ONLY
 * - invoice.paid → mark ACTIVE
 * - invoice.payment_failed → marks PAST_DUE
 *
 * Safety rules:
 * - ADMIN and comped users are never modified by webhooks (plan, status, role all preserved).
 * - Idempotency: Stripe event IDs are persisted in StripeEvent table. Duplicate
 *   events (Stripe retries) are skipped.
 * - Solo subscriptions are owned by User; community subscriptions are owned by
 *   Organization. Webhook handlers do not fall through from org→user for
 *   community events.
 */
export async function POST(request: Request) {
  if (!isStripeWebhookConfigured()) {
    console.error("[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[STRIPE WEBHOOK] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const claim = await claimStripeEvent(event);
  if (claim.status === "SUCCEEDED") {
    console.log(`[STRIPE WEBHOOK] Duplicate event ${event.id} (${event.type}) — skipping`);
    return NextResponse.json({ received: true });
  }
  if (claim.status === "BUSY") {
    // Returning a retryable response prevents a concurrent request from
    // acknowledging an event whose active worker could still fail.
    return NextResponse.json({ error: "Event is already being processed" }, { status: 409 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      }
      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }
      case "invoice.paid": {
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      }
      case "invoice.payment_failed": {
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      }
      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[STRIPE WEBHOOK] Failed to process ${event.type}:`, err);
    await prisma.stripeEvent.updateMany({
      where: {
        eventId: event.id,
        status: "PROCESSING",
        claimToken: claim.claimToken,
      },
      data: {
        status: "FAILED",
        lastError: (err instanceof Error ? err.message : String(err)).slice(0, 2000),
      },
    });
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  const completed = await prisma.stripeEvent.updateMany({
    where: {
      eventId: event.id,
      status: "PROCESSING",
      claimToken: claim.claimToken,
    },
    data: {
      status: "SUCCEEDED",
      processedAt: new Date(),
      lastError: null,
    },
  });

  if (completed.count !== 1) {
    console.error(`[STRIPE WEBHOOK] Lost processing lease for ${event.id}`);
    return NextResponse.json({ error: "Processing lease expired" }, { status: 409 });
  }

  return NextResponse.json({ received: true });
}

const STRIPE_EVENT_LEASE_MS = 5 * 60 * 1000;

async function claimStripeEvent(
  event: Stripe.Event
): Promise<
  | { status: "CLAIMED"; claimToken: string }
  | { status: "SUCCEEDED" }
  | { status: "BUSY" }
> {
  const now = new Date();
  const claimToken = randomUUID();

  try {
    await prisma.stripeEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
        status: "PROCESSING",
        claimToken,
        claimedAt: now,
      },
    });
    return { status: "CLAIMED", claimToken };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  const existing = await prisma.stripeEvent.findUnique({
    where: { eventId: event.id },
    select: { status: true },
  });
  if (existing?.status === "SUCCEEDED") return { status: "SUCCEEDED" };

  const staleBefore = new Date(now.getTime() - STRIPE_EVENT_LEASE_MS);
  const reclaimed = await prisma.stripeEvent.updateMany({
    where: {
      eventId: event.id,
      OR: [
        { status: "FAILED" },
        { status: "PROCESSING", claimedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "PROCESSING",
      eventType: event.type,
      claimToken,
      claimedAt: now,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  return reclaimed.count === 1
    ? { status: "CLAIMED", claimToken }
    : { status: "BUSY" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function getCustomerId(obj: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined }): string | null {
  const c = obj.customer;
  if (typeof c === "string") return c;
  if (c && "id" in c) return c.id;
  return null;
}

function getSubscriptionId(obj: { subscription: string | Stripe.Subscription | null | undefined }): string | null {
  return typeof obj.subscription === "string" ? obj.subscription : obj.subscription?.id ?? null;
}

/** Check if a user should be protected from webhook modifications.
 *  ADMIN users and comped users are never overwritten by webhook events. */
async function isProtectedUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isComped: true },
  });
  if (!user) return false;
  return user.role === "ADMIN" || user.isComped;
}

// ─── checkout.session.completed ─────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const checkoutSource = session.metadata?.checkoutSource;

  // Public homepage checkout — no userId, fulfillment via email + PendingStripeInvite
  if (checkoutSource === "public_homepage") {
    await handlePublicCheckoutCompleted(session);
    return;
  }

  const userId = session.client_reference_id || session.metadata?.userId;
  if (!userId) {
    console.error("[STRIPE WEBHOOK] checkout.session.completed — no userId in session");
    return;
  }

  const customerId = getCustomerId(session);
  const subscriptionId = getSubscriptionId(session);

  if (!customerId || !subscriptionId) {
    console.error("[STRIPE WEBHOOK] checkout.session.completed — missing customer or subscription ID");
    return;
  }

  const purchaseType = session.metadata?.purchaseType;

  if (purchaseType === "community") {
    await fulfillCommunityCheckout(userId, customerId, subscriptionId, session);
  } else {
    // Solo (or unspecified — default to solo for backward compat with pre-metadata sessions)
    await fulfillSoloCheckout(userId, customerId, subscriptionId);

    // Check if this is a switch-from-community checkout (deferred org changes)
    const switchFromOrgId = session.metadata?.switchFromOrgId;
    if (switchFromOrgId) {
      await processSwitchFromCommunity(userId, switchFromOrgId);
    }
  }
}

async function fulfillSoloCheckout(userId: string, customerId: string, subscriptionId: string) {
  // Don't modify ADMIN or comped users
  if (await isProtectedUser(userId)) {
    console.log(`[STRIPE WEBHOOK] Skipping solo checkout for protected user ${userId}`);
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeStatus: subscription.status,
      plan: "PRO",
      accountStatus: stripeStatusToAccountStatus(subscription.status),
      isComped: false,
      organizationId: null,
    },
  });

  console.log(`[STRIPE WEBHOOK] User ${userId} upgraded to PRO via Solo checkout`);
}

/**
 * Process deferred switch-from-community: schedule org cancellation at period end,
 * transfer TEAM_ADMIN to a successor, and remove the original admin from the org.
 * Only called after solo checkout is confirmed (checkout.session.completed).
 */
async function processSwitchFromCommunity(userId: string, orgId: string) {
  const stripe = getStripe();

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, stripeSubscriptionId: true },
  });
  if (!org) {
    console.warn(`[STRIPE WEBHOOK] switchFromOrgId ${orgId} not found — skipping org changes`);
    return;
  }

  // Schedule org subscription cancellation at period end
  if (org.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.update(org.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      await prisma.organization.update({
        where: { id: orgId },
        data: { stripeStatus: "cancel_at_period_end" },
      });
      console.log(`[STRIPE WEBHOOK] Org ${orgId} subscription scheduled to cancel at period end`);
    } catch (err) {
      console.error(`[STRIPE WEBHOOK] Failed to schedule org cancellation for ${orgId}:`, err);
    }
  }

  // Find successor: oldest active, non-archived, non-ADMIN member (excluding the switching user)
  const successor = await prisma.user.findFirst({
    where: {
      organizationId: orgId,
      id: { not: userId },
      role: { not: "ADMIN" },
      accountStatus: { not: "ARCHIVED" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (successor) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: successor.id },
        data: { role: "TEAM_ADMIN" },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          role: "USER",
          organizationId: null,
        },
      }),
    ]);
    console.log(`[STRIPE WEBHOOK] Switch: admin transferred to ${successor.id}, user ${userId} removed from org`);
  } else {
    // No successor — just remove the user from the org
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "USER",
        organizationId: null,
      },
    });
    console.log(`[STRIPE WEBHOOK] Switch: no successor found, user ${userId} removed from org ${orgId}`);
  }
}

async function fulfillCommunityCheckout(
  userId: string,
  customerId: string,
  subscriptionId: string,
  session: Stripe.Checkout.Session
) {
  // Don't modify ADMIN users' plan/role, but still create/update the org
  const isProtected = await isProtectedUser(userId);

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const quantity = subscription.items.data[0]?.quantity ?? 1;
  const organizationName = session.metadata?.organizationName || "Community";

  // Find existing org by stripeCustomerId or stripeSubscriptionId
  const existingOrg = await prisma.organization.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { stripeSubscriptionId: subscriptionId },
      ],
    },
  });

  let organizationId: string;

  if (existingOrg) {
    // Update existing org
    await prisma.organization.update({
      where: { id: existingOrg.id },
      data: {
        name: organizationName,
        seatLimit: quantity,
        seatPlan: "PRO",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeStatus: subscription.status,
      },
    });
    organizationId = existingOrg.id;
    console.log(`[STRIPE WEBHOOK] Organization ${organizationId} updated — seatLimit: ${quantity}`);
  } else {
    // Create new org
    const newOrg = await prisma.organization.create({
      data: {
        name: organizationName,
        seatLimit: quantity,
        seatPlan: "PRO",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        stripeStatus: subscription.status,
      },
    });
    organizationId = newOrg.id;
    console.log(`[STRIPE WEBHOOK] Organization ${organizationId} created — seatLimit: ${quantity}`);
  }

  if (isProtected) {
    // For ADMIN/comped users: link them to the org but don't change plan/role/status
    // and don't set stripeCustomerId/subscriptionId on the user (those live on the org)
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId,
      },
    });
    console.log(`[STRIPE WEBHOOK] Protected user ${userId} linked to org ${organizationId} (plan/role preserved)`);
    return;
  }

  // Set purchaser as TEAM_ADMIN with PRO plan
  // Stripe billing fields live on the Organization, not the User, for community subs
  await prisma.user.update({
    where: { id: userId },
    data: {
      role: "TEAM_ADMIN",
      plan: "PRO",
      accountStatus: stripeStatusToAccountStatus(subscription.status),
      isComped: false,
      organizationId,
    },
  });

  console.log(`[STRIPE WEBHOOK] User ${userId} set as TEAM_ADMIN of org ${organizationId}`);
}

// ─── Public checkout fulfillment ────────────────────────────────────────────

const PENDING_INVITE_EXPIRY_DAYS = 14;

async function handlePublicCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = getCustomerId(session);
  const subscriptionId = getSubscriptionId(session);

  if (!customerId || !subscriptionId) {
    console.error("[STRIPE WEBHOOK] public checkout — missing customer or subscription ID");
    return;
  }

  const email = session.customer_details?.email;
  if (!email) {
    console.error("[STRIPE WEBHOOK] public checkout — no customer email in session");
    return;
  }

  const purchaseType = (session.metadata?.purchaseType ?? "solo") as "solo" | "community";
  const billingInterval = (session.metadata?.billingInterval ?? "monthly") as "monthly" | "annual";
  const seats = parseInt(session.metadata?.seats ?? "1", 10);
  const organizationName = session.metadata?.organizationName;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const stripeStatus = subscription.status;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (purchaseType === "community") {
    // Create or update organization (idempotent by stripeCustomerId/stripeSubscriptionId)
    const existingOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { stripeCustomerId: customerId },
          { stripeSubscriptionId: subscriptionId },
        ],
      },
    });

    let organizationId: string;
    const orgName = organizationName || "Community";
    const quantity = subscription.items.data[0]?.quantity ?? seats ?? 1;

    if (existingOrg) {
      await prisma.organization.update({
        where: { id: existingOrg.id },
        data: {
          name: orgName,
          seatLimit: quantity,
          seatPlan: "PRO",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeStatus,
        },
      });
      organizationId = existingOrg.id;
      console.log(`[STRIPE WEBHOOK] Public community — org ${organizationId} updated — seats: ${quantity}`);
    } else {
      const newOrg = await prisma.organization.create({
        data: {
          name: orgName,
          seatLimit: quantity,
          seatPlan: "PRO",
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          stripeStatus,
        },
      });
      organizationId = newOrg.id;
      console.log(`[STRIPE WEBHOOK] Public community — org ${organizationId} created — seats: ${quantity}`);
    }

    if (existingUser) {
      // User exists — link them as TEAM_ADMIN (unless protected)
      const isProtected = existingUser.role === "ADMIN" || existingUser.isComped;
      if (isProtected) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { organizationId },
        });
        console.log(`[STRIPE WEBHOOK] Public community — protected user ${existingUser.id} linked to org ${organizationId}`);
      } else {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: "TEAM_ADMIN",
            plan: "PRO",
            accountStatus: stripeStatusToAccountStatus(stripeStatus),
            isComped: false,
            organizationId,
          },
        });
        console.log(`[STRIPE WEBHOOK] Public community — user ${existingUser.id} set as TEAM_ADMIN of org ${organizationId}`);
      }
      return;
    }

    // User doesn't exist — create PendingStripeInvite
    await createPendingStripeInvite({
      email,
      purchaseType: "community",
      billingInterval,
      organizationName: orgName,
      seats: quantity,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeStatus,
      inviteRole: "TEAM_ADMIN",
      organizationId,
    });
  } else {
    // Solo
    if (existingUser) {
      const isProtected = existingUser.role === "ADMIN" || existingUser.isComped;
      if (!isProtected) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripeStatus,
            plan: "PRO",
            accountStatus: stripeStatusToAccountStatus(stripeStatus),
            isComped: false,
            organizationId: null,
          },
        });
        console.log(`[STRIPE WEBHOOK] Public solo — user ${existingUser.id} upgraded to PRO`);
      } else {
        console.log(`[STRIPE WEBHOOK] Public solo — skipping protected user ${existingUser.id}`);
      }
      return;
    }

    // User doesn't exist — create PendingStripeInvite
    await createPendingStripeInvite({
      email,
      purchaseType: "solo",
      billingInterval,
      seats: 1,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeStatus,
      inviteRole: "USER",
    });
  }
}

async function createPendingStripeInvite(params: {
  email: string;
  purchaseType: "solo" | "community";
  billingInterval: "monthly" | "annual";
  organizationName?: string;
  seats?: number;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeStatus: string;
  inviteRole: "USER" | "TEAM_ADMIN";
  organizationId?: string;
}) {
  // Check for existing pending invite by email — don't create duplicates
  const existing = await prisma.pendingStripeInvite.findFirst({
    where: { email: params.email },
  });
  if (existing) {
    // Update the existing one with new Stripe info
    await prisma.pendingStripeInvite.update({
      where: { id: existing.id },
      data: {
        purchaseType: params.purchaseType,
        billingInterval: params.billingInterval,
        organizationName: params.organizationName,
        seats: params.seats,
        stripeCustomerId: params.stripeCustomerId,
        stripeSubscriptionId: params.stripeSubscriptionId,
        stripeStatus: params.stripeStatus,
        inviteRole: params.inviteRole,
        organizationId: params.organizationId,
        expiresAt: new Date(Date.now() + PENDING_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`[STRIPE WEBHOOK] Updated existing PendingStripeInvite for ${params.email}`);
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + PENDING_INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.pendingStripeInvite.create({
    data: {
      email: params.email,
      token,
      purchaseType: params.purchaseType,
      billingInterval: params.billingInterval,
      organizationName: params.organizationName,
      seats: params.seats,
      stripeCustomerId: params.stripeCustomerId,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeStatus: params.stripeStatus,
      plan: "PRO",
      inviteRole: params.inviteRole,
      organizationId: params.organizationId,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerUrl = `${baseUrl}/register?token=${token}`;

  const emailSent = await sendPaidMembershipRegistrationEmail({
    email: params.email,
    registerUrl,
    purchaseType: params.purchaseType,
    organizationName: params.organizationName,
  });

  if (!emailSent) {
    console.error(`[STRIPE WEBHOOK] Failed to send paid registration email to ${params.email} — invite token created but email not sent`);
  } else {
    console.log(`[STRIPE WEBHOOK] PendingStripeInvite created + email sent for ${params.email} (${params.purchaseType})`);
  }
}

// ─── customer.subscription.updated ──────────────────────────────────────────

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const purchaseType = subscription.metadata?.purchaseType;
  const customerId = getCustomerId(subscription);

  if (purchaseType === "community") {
    // Look up organization by stripeSubscriptionId or stripeCustomerId
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscription.id },
          ...(customerId ? [{ stripeCustomerId: customerId }] : []),
        ],
      },
    });

    if (org) {
      const quantity = subscription.items.data[0]?.quantity ?? org.seatLimit;
      const effectiveStatus = subscription.cancel_at_period_end
        ? "cancel_at_period_end"
        : subscription.status;
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          stripeStatus: effectiveStatus,
          seatLimit: quantity,
        },
      });
      console.log(`[STRIPE WEBHOOK] Org ${org.id} subscription updated — status: ${effectiveStatus}, seats: ${quantity}`);
      return;
    }
    // Community event with no matching org — do NOT fall through to user lookup
    console.warn("[STRIPE WEBHOOK] community subscription.updated — no org found, not falling through to user");
    return;
  }

  // Solo subscription — try user lookup
  const userId = subscription.metadata?.userId;
  if (userId) {
    await updateUserFromSubscription(userId, subscription);
    return;
  }

  // Try to find user by stripeCustomerId
  if (customerId) {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (user) {
      await updateUserFromSubscription(user.id, subscription);
      return;
    }
  }

  console.warn("[STRIPE WEBHOOK] subscription.updated — no user or org found");
}

async function updateUserFromSubscription(userId: string, subscription: Stripe.Subscription) {
  // Protect ADMIN users
  if (await isProtectedUser(userId)) {
    console.log(`[STRIPE WEBHOOK] Skipping subscription.updated for ADMIN user ${userId}`);
    return;
  }

  // If cancel_at_period_end is true, keep the user ACTIVE until the period ends.
  // Store a synthetic status so the UI can show "cancellation scheduled".
  const effectiveStatus = subscription.cancel_at_period_end
    ? "cancel_at_period_end"
    : subscription.status;

  const accountStatus = subscription.cancel_at_period_end
    ? "ACTIVE" as const
    : stripeStatusToAccountStatus(subscription.status);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripeStatus: effectiveStatus,
      accountStatus,
    },
  });
  console.log(`[STRIPE WEBHOOK] User ${userId} subscription updated — status: ${effectiveStatus}`);
}

// ─── customer.subscription.deleted ──────────────────────────────────────────

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const purchaseType = subscription.metadata?.purchaseType;
  const customerId = getCustomerId(subscription);

  if (purchaseType === "community") {
    // Look up organization
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { stripeSubscriptionId: subscription.id },
          ...(customerId ? [{ stripeCustomerId: customerId }] : []),
        ],
      },
    });

    if (org) {
      await downgradeOrganization(org.id);
      return;
    }
    // Community event with no matching org — do NOT fall through to user lookup
    console.warn("[STRIPE WEBHOOK] community subscription.deleted — no org found, not falling through to user");
    return;
  }

  // Solo subscription
  const userId = subscription.metadata?.userId;
  if (userId) {
    await downgradeUser(userId);
    return;
  }

  // Try to find user by stripeCustomerId
  if (customerId) {
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (user) {
      await downgradeUser(user.id);
      return;
    }
  }

  console.warn("[STRIPE WEBHOOK] subscription.deleted — no user or org found");
}

async function downgradeUser(userId: string) {
  // Protect ADMIN and comped users
  if (await isProtectedUser(userId)) {
    console.log(`[STRIPE WEBHOOK] Skipping downgrade for protected user ${userId}`);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      accountStatus: "ARCHIVED",
      plan: "CALENDAR_ONLY",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      stripeStatus: "canceled",
    },
  });
  console.log(`[STRIPE WEBHOOK] User ${userId} downgraded to CALENDAR_ONLY + ARCHIVED (subscription deleted)`);
}

async function downgradeOrganization(orgId: string) {
  // Mark org as canceled, clear Stripe billing fields, preserve data for reactivation
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      stripeStatus: "canceled",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    },
  });

  // Downgrade non-ADMIN, non-comped members to ARCHIVED + CALENDAR_ONLY
  const members = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      role: { not: "ADMIN" },
      isComped: false,
    },
    select: { id: true },
  });

  if (members.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: members.map((m) => m.id) } },
      data: {
        accountStatus: "ARCHIVED",
        plan: "CALENDAR_ONLY",
      },
    });
  }

  console.log(`[STRIPE WEBHOOK] Org ${orgId} canceled — ${members.length} members downgraded`);
}

// ─── invoice events ─────────────────────────────────────────────────────────

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = getCustomerId(invoice);
  if (!customerId) return;

  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id;
  if (!subscriptionId) return;

  // Check if this belongs to an organization
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: subscriptionId },
        { stripeCustomerId: customerId },
      ],
    },
  });
  if (org) {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await prisma.organization.update({
      where: { id: org.id },
      data: {
        stripeStatus: subscription.status,
      },
    });
    return;
  }

  // Solo user — find by stripeCustomerId
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return;

  // Protect ADMIN and comped users
  if (await isProtectedUser(user.id)) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeStatus: subscription.status,
      accountStatus: stripeStatusToAccountStatus(subscription.status),
    },
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const customerId = getCustomerId(invoice);
  if (!customerId) return;

  // Check org first
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
  if (org) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeStatus: "past_due" },
    });
    return;
  }

  // Solo user — find by stripeCustomerId
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (!user) return;

  // Protect ADMIN and comped users
  if (await isProtectedUser(user.id)) return;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeStatus: "past_due",
      accountStatus: "PAST_DUE",
    },
  });

  console.log(`[STRIPE WEBHOOK] User ${user.id} marked PAST_DUE due to failed payment`);
}
