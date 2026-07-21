"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  getOrganizationSeatUsage,
  canInviteOrganizationMember,
  requireTeamAdminOrganization,
  assertTeamAdminCanManageUser,
} from "@/lib/organizations";
import { sendTeamInviteEmail } from "@/lib/invite-email";
import type { UserPlan } from "@/lib/tiers";

const INVITE_EXPIRY_DAYS = 7;

export interface TeamMember {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  plan: UserPlan;
  createdAt: Date;
  onboardingComplete: boolean;
  accountStatus: string;
  internalTag: string | null;
  isComped: boolean;
}

export interface TeamPendingInvite {
  id: string;
  email: string;
  plan: UserPlan;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
}

export interface TeamRosterData {
  organization: {
    id: string;
    name: string;
    seatPlan: UserPlan;
    seatLimit: number;
  };
  usage: {
    activeUsers: number;
    pendingInvites: number;
    usedSeats: number;
    seatLimit: number;
    availableSeats: number;
    isOverLimit: boolean;
  };
  members: TeamMember[];
  pendingInvites: TeamPendingInvite[];
}

async function requireTeamAdmin(): Promise<{
  user: { id: string; organizationId: string };
  organizationId: string;
} | null> {
  const result = await requireTeamAdminOrganization();
  if (!result) return null;
  if (!result.user.organizationId) return null;
  return {
    user: { id: result.user.id, organizationId: result.user.organizationId },
    organizationId: result.user.organizationId,
  };
}

export async function getTeamRoster(): Promise<{ data?: TeamRosterData; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { error: "Unauthorized" };

  const [organization, usage, members, pendingInvitesRaw] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, seatPlan: true, seatLimit: true },
    }),
    getOrganizationSeatUsage(ctx.organizationId),
    prisma.user.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        createdAt: true,
        accountStatus: true,
        internalTag: true,
        isComped: true,
        questionnaires: { select: { id: true }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inviteToken.findMany({
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!organization) return { error: "Organization not found" };

  const now = new Date();

  return {
    data: {
      organization: {
        id: organization.id,
        name: organization.name,
        seatPlan: organization.seatPlan as UserPlan,
        seatLimit: organization.seatLimit,
      },
      usage,
      members: members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        plan: (m.plan ?? "CALENDAR_ONLY") as UserPlan,
        createdAt: m.createdAt,
        onboardingComplete: m.questionnaires.length > 0,
        accountStatus: m.accountStatus,
        internalTag: m.internalTag,
        isComped: m.isComped,
      })),
      pendingInvites: pendingInvitesRaw.map((i) => ({
        id: i.id,
        email: i.email,
        plan: (i.plan ?? "CALENDAR_ONLY") as UserPlan,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
        expired: i.expiresAt < now,
      })),
    },
  };
}

export async function createTeamInvite(
  email: string,
  name?: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
    return { success: false, error: "A valid email address is required." };
  }

  // Prevent inviting an email that already has an account
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return {
      success: false,
      error:
        "This email is already associated with an account. Existing-account transfer is not supported yet.",
    };
  }

  // Prevent duplicate pending invite for the same email in this org
  const existingInvite = await prisma.inviteToken.findUnique({ where: { email: normalizedEmail } });
  if (existingInvite && existingInvite.organizationId === ctx.organizationId && existingInvite.expiresAt > new Date()) {
    return { success: false, error: "An invite has already been sent to this email." };
  }
  // If there's a stale invite for this email (different org or expired), delete it first
  if (existingInvite) {
    await prisma.inviteToken.delete({ where: { id: existingInvite.id } });
  }

  // Enforce seat limit inside a transaction to prevent race conditions.
  // Two concurrent requests could both see an available seat and create
  // invites beyond the limit. The transaction re-checks seat usage
  // immediately before creating the invite.
  //
  // Note: Prisma's $transaction uses the default PostgreSQL isolation level
  // (READ COMMITTED). This significantly narrows the race window but does
  // not guarantee perfect isolation. For true row-level locking, a future
  // improvement could use SELECT ... FOR UPDATE via raw SQL.
  const organization = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { seatPlan: true, name: true, seatLimit: true },
  });
  if (!organization) return { success: false, error: "Organization not found" };

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  try {
    await prisma.$transaction(async (tx) => {
      // Re-check seat usage inside the transaction
      const now = new Date();
      const [activeUsers, pendingInvites] = await Promise.all([
        tx.user.count({ where: { organizationId: ctx.organizationId } }),
        tx.inviteToken.count({
          where: {
            organizationId: ctx.organizationId,
            expiresAt: { gt: now },
          },
        }),
      ]);

      const usedSeats = activeUsers + pendingInvites;
      if (usedSeats >= organization.seatLimit) {
        throw new Error("SEAT_LIMIT_REACHED");
      }

      await tx.inviteToken.create({
        data: {
          email: normalizedEmail,
          token,
          expiresAt,
          plan: organization.seatPlan,
          organizationId: ctx.organizationId,
          invitedByUserId: ctx.user.id,
          inviteSource: "TEAM_ADMIN",
          inviteRole: "USER",
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "SEAT_LIMIT_REACHED") {
      return { success: false, error: "Your organization has reached its seat limit." };
    }
    return { success: false, error: "Failed to create invite. Please try again." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerUrl = `${baseUrl}/register?token=${token}`;

  const emailSent = await sendTeamInviteEmail({
    email: normalizedEmail,
    organizationName: organization.name,
    registerUrl,
    isTeamAdminInvite: false,
  });

  if (!emailSent) {
    return { success: true, error: "Invite created, but the email failed to send. Share the registration link manually." };
  }

  // Optionally store the name on the user after they register — for now we
  // don't persist it since InviteToken has no name field.
  void name;

  return { success: true };
}

export async function cancelTeamInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const invite = await prisma.inviteToken.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== ctx.organizationId) {
    return { success: false, error: "Invite not found." };
  }

  try {
    await prisma.inviteToken.delete({ where: { id: inviteId } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to cancel invite." };
  }
}

export async function resendTeamInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const invite = await prisma.inviteToken.findUnique({ where: { id: inviteId } });
  if (!invite || invite.organizationId !== ctx.organizationId) {
    return { success: false, error: "Invite not found." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const registerUrl = `${baseUrl}/register?token=${invite.token}`;

  const organization = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { name: true },
  });

  const emailSent = await sendTeamInviteEmail({
    email: invite.email,
    organizationName: organization?.name ?? "your organization",
    registerUrl,
    isTeamAdminInvite: false,
  });

  if (!emailSent) {
    return { success: false, error: "Failed to resend invite email." };
  }

  return { success: true };
}

export async function removeTeamMember(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { success: false, error: "Unauthorized" };

  if (ctx.user.id === userId) {
    return { success: false, error: "You cannot remove yourself from the organization." };
  }

  const canManage = await assertTeamAdminCanManageUser(ctx.organizationId, userId);
  if (!canManage) {
    return { success: false, error: "You can only manage members of your own organization." };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!target) return { success: false, error: "User not found." };

  // Only allow removing regular USER members, not other admins
  if (target.role === "ADMIN" || target.role === "TEAM_ADMIN") {
    return { success: false, error: "You cannot remove admin accounts." };
  }

  try {
    // Detach from org and lock the account — they must subscribe to
    // their own membership to regain access. Clear Stripe fields since
    // they're no longer on the org's subscription.
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: null,
        accountStatus: "ARCHIVED",
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeStatus: null,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove team member." };
  }
}

export async function transferTeamAdmin(
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdmin();
  if (!ctx) return { success: false, error: "Unauthorized" };

  if (ctx.user.id === targetUserId) {
    return { success: false, error: "You cannot transfer admin to yourself." };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, organizationId: true, accountStatus: true },
  });

  if (!target) return { success: false, error: "User not found." };
  if (target.organizationId !== ctx.organizationId) {
    return { success: false, error: "You can only transfer to a member of your own organization." };
  }
  if (target.role === "ADMIN") {
    return { success: false, error: "You cannot transfer to a global admin." };
  }
  if (target.accountStatus === "ARCHIVED") {
    return { success: false, error: "You cannot transfer to a locked member." };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: ctx.user.id },
        data: { role: "USER" },
      }),
      prisma.user.update({
        where: { id: targetUserId },
        data: { role: "TEAM_ADMIN" },
      }),
    ]);
    return { success: true };
  } catch {
    return { success: false, error: "Failed to transfer admin role." };
  }
}

// Re-export redirect so the page can use it if needed
export { redirect };
