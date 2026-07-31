"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendPaidMembershipRegistrationEmail } from "@/lib/paid-registration-email";
import { isPast } from "date-fns";

export interface PendingStripeInviteRow {
  id: string;
  email: string;
  purchaseType: string;
  billingInterval: string;
  organizationName: string | null;
  seats: number | null;
  stripeStatus: string | null;
  inviteRole: string;
  plan: string;
  expiresAt: string;
  createdAt: string;
  expired: boolean;
  emailSentAt: string | null;
  lastEmailError: string | null;
}

export async function getPendingStripeInvites(): Promise<PendingStripeInviteRow[]> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const invites = await prisma.pendingStripeInvite.findMany({
    orderBy: { createdAt: "desc" },
  });

  return invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    purchaseType: inv.purchaseType,
    billingInterval: inv.billingInterval,
    organizationName: inv.organizationName,
    seats: inv.seats,
    stripeStatus: inv.stripeStatus,
    inviteRole: inv.inviteRole,
    plan: inv.plan,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    expired: isPast(inv.expiresAt),
    emailSentAt: inv.emailSentAt?.toISOString() ?? null,
    lastEmailError: inv.lastEmailError,
  }));
}

export async function resendPendingInviteEmail(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const invite = await prisma.pendingStripeInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  if (isPast(invite.expiresAt)) {
    await prisma.pendingStripeInvite.update({
      where: { id: invite.id },
      data: {
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerUrl = `${baseUrl}/register?token=${invite.token}`;

  const emailSent = await sendPaidMembershipRegistrationEmail({
    email: invite.email,
    registerUrl,
    purchaseType: invite.purchaseType as "solo" | "community",
    organizationName: invite.organizationName ?? undefined,
  });

  await prisma.pendingStripeInvite.update({
    where: { id: invite.id },
    data: {
      emailSentAt: emailSent ? new Date() : null,
      lastEmailError: emailSent ? null : "Admin resend failed — check RESEND_FROM_EMAIL and API key",
    },
  });

  if (!emailSent) {
    return { success: false, error: "Failed to send email — check RESEND_FROM_EMAIL and API key" };
  }

  return { success: true };
}

export async function deletePendingStripeInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const invite = await prisma.pendingStripeInvite.findUnique({
    where: { id: inviteId },
    select: { email: true, stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!invite) {
    return { success: false, error: "Invite not found" };
  }

  await prisma.pendingStripeInvite.delete({ where: { id: inviteId } });

  const warning = invite.stripeSubscriptionId
    ? `Invite revoked for ${invite.email}, but Stripe subscription ${invite.stripeSubscriptionId} is still active. Cancel it in Stripe if needed.`
    : undefined;

  return { success: true, warning };
}
