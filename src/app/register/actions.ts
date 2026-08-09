"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendSignupNotification } from "@/lib/signup-notification";
import { stripeStatusToAccountStatus } from "@/lib/stripe";
import type Stripe from "stripe";

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

    // Ownership invariant: Community subscriptions belong to Organization,
    // Solo subscriptions belong to User. For community registrations, the
    // Stripe fields are already on the Organization (set by the webhook) and
    // must NOT be copied onto the User — copying them would make the cancel
    // route treat the community sub as a solo sub and update the wrong record.
    // For solo registrations (no org), the Stripe fields belong on the User.
    const isCommunity = !!pendingInvite.organizationId;

    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: pendingInvite.email,
          password: hashedPassword,
          role: assignedRole,
          plan: pendingInvite.plan ?? "PRO",
          accountStatus: stripeStatusToAccountStatus((pendingInvite.stripeStatus ?? "active") as Stripe.Subscription.Status),
          isComped: false,
          organizationId: pendingInvite.organizationId ?? null,
          stripeCustomerId: isCommunity ? null : pendingInvite.stripeCustomerId,
          stripeSubscriptionId: isCommunity ? null : pendingInvite.stripeSubscriptionId,
          stripeStatus: isCommunity ? null : pendingInvite.stripeStatus,
          hasUsedTrial: pendingInvite.hasUsedTrial,
          trialEndsAt: pendingInvite.trialEndsAt,
        },
      }),
      prisma.pendingStripeInvite.delete({ where: { token } }),
    ]);

    // Wrap in after() so the notification email is guaranteed to send even
    // after the redirect response is sent. Previously fire-and-forget could
    // be dropped when the serverless function terminated after signIn redirect.
    after(async () => {
      try {
        await sendSignupNotification(pendingInvite.email, "self-registration");
      } catch (err) {
        console.error("[SIGNUP NOTIFICATION] Failed:", err);
      }
    });

    // Sign in the newly created user so the session cookie is set before
    // redirecting to onboarding. Without this, /api/questionnaire rejects
    // the submission with "Not authenticated" because no session exists.
    try {
      await signIn("credentials", {
        email: pendingInvite.email,
        password,
        redirectTo: "/onboarding",
      });
    } catch (error) {
      if (error instanceof AuthError) {
        return { error: "Account created, but automatic sign-in failed. Please log in." };
      }
      throw error; // NEXT_REDIRECT propagates here
    }
    redirect("/onboarding"); // fallback — signIn with redirectTo throws first
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

  after(async () => {
    try {
      await sendSignupNotification(invite.email, "self-registration");
    } catch (err) {
      console.error("[SIGNUP NOTIFICATION] Failed:", err);
    }
  });

  try {
    await signIn("credentials", {
      email: invite.email,
      password,
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but automatic sign-in failed. Please log in." };
    }
    throw error; // NEXT_REDIRECT propagates here
  }
  redirect("/onboarding"); // fallback — signIn with redirectTo throws first
}
