"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendSignupNotification } from "@/lib/signup-notification";

// Only USER and TEAM_ADMIN are valid roles for invite-based registration.
// ADMIN must never be assignable via invite token — it is a global admin role
// that can only be granted directly by an existing ADMIN via the admin panel.
const ALLOWED_INVITE_ROLES = ["USER", "TEAM_ADMIN"] as const;

export async function registerWithToken(
  token: string,
  password: string
): Promise<{ error: string } | never> {
  if (!token || !password) {
    return { error: "Missing required fields." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: "Password must include at least one letter and one number." };
  }

  // Check both InviteToken (admin/team invite) and PendingStripeInvite (public checkout)
  const [invite, pendingInvite] = await Promise.all([
    prisma.inviteToken.findUnique({ where: { token } }),
    prisma.pendingStripeInvite.findUnique({ where: { token } }),
  ]);

  if (!invite && !pendingInvite) {
    return { error: "This invitation link is invalid or has already been used." };
  }

  // ─── PendingStripeInvite flow (public checkout) ───
  if (pendingInvite) {
    if (pendingInvite.expiresAt < new Date()) {
      return { error: "This registration link has expired." };
    }

    const assignedRole = pendingInvite.inviteRole ?? "USER";
    if (!ALLOWED_INVITE_ROLES.includes(assignedRole as typeof ALLOWED_INVITE_ROLES[number])) {
      return { error: "This registration link is invalid." };
    }

    if (pendingInvite.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: pendingInvite.organizationId },
        select: { id: true },
      });
      if (!org) {
        return { error: "This registration link is no longer valid — the organization no longer exists." };
      }
    }

    const existingUser = await prisma.user.findUnique({ where: { email: pendingInvite.email } });
    if (existingUser) {
      return { error: "An account with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: pendingInvite.email,
          password: hashedPassword,
          role: assignedRole,
          plan: pendingInvite.plan ?? "PRO",
          accountStatus: "ACTIVE",
          isComped: false,
          organizationId: pendingInvite.organizationId ?? null,
          stripeCustomerId: pendingInvite.stripeCustomerId,
          stripeSubscriptionId: pendingInvite.stripeSubscriptionId,
          stripeStatus: pendingInvite.stripeStatus,
        },
      }),
      prisma.pendingStripeInvite.delete({ where: { token } }),
    ]);

    sendSignupNotification(pendingInvite.email, "self-registration").catch((err) =>
      console.error("[SIGNUP NOTIFICATION] Failed:", err)
    );

    redirect("/onboarding");
  }

  // ─── InviteToken flow (admin/team invite) ───
  if (!invite) {
    return { error: "This invitation link is invalid or has already been used." };
  }

  if (invite.expiresAt < new Date()) {
    return { error: "This invitation link has expired." };
  }

  // Block ADMIN role from invite-based registration — prevents privilege
  // escalation even if a token is tampered with or misconfigured.
  const assignedRole = invite.inviteRole ?? "USER";
  if (!ALLOWED_INVITE_ROLES.includes(assignedRole as typeof ALLOWED_INVITE_ROLES[number])) {
    return { error: "This invitation link is invalid." };
  }

  // If the invite references an organization, verify it still exists.
  // A deleted org would leave the user in a broken state.
  if (invite.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: { id: true },
    });
    if (!org) {
      return { error: "This invitation link is no longer valid — the organization no longer exists." };
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Wrap user creation + token deletion in a transaction so that a failure
  // in either operation doesn't leave inconsistent state (e.g. user created
  // but token not deleted, allowing reuse).
  //
  // Seat counting note: A pending invite reserves a seat at creation time.
  // Registration converts the reserved seat to an active user seat. The invite
  // token is deleted, keeping total used seats stable across registration.
  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        role: assignedRole,
        plan: invite.plan ?? "PRO",
        organizationId: invite.organizationId ?? null,
      },
    }),
    prisma.inviteToken.delete({ where: { token } }),
  ]);

  sendSignupNotification(invite.email, "self-registration").catch((err) =>
    console.error("[SIGNUP NOTIFICATION] Failed:", err)
  );

  redirect("/onboarding");
}
