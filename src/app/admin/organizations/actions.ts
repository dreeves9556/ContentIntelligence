"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateUniqueSlug } from "@/lib/organizations";
import { sendTeamInviteEmail } from "@/lib/invite-email";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";
import { decideOrgDelete, decideAfterStripeCancelFailure } from "@/lib/deletion-hardening";
import type { UserPlan } from "@/lib/tiers";

const INVITE_EXPIRY_DAYS = 7;

export interface AdminOrgMember {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  plan: UserPlan;
  createdAt: Date;
  accountStatus: string;
  internalTag: string | null;
  isComped: boolean;
}

export interface AdminOrgData {
  id: string;
  name: string;
  slug: string | null;
  seatLimit: number;
  seatPlan: UserPlan;
  stripeStatus: string | null;
  createdAt: Date;
  activeUsers: number;
  pendingInvites: number;
  usedSeats: number;
  isOverLimit: boolean;
  teamAdmins: AdminOrgMember[];
  members: AdminOrgMember[];
}

export async function getOrganizations(): Promise<{ data?: AdminOrgData[]; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
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
        },
        orderBy: { createdAt: "desc" },
      },
      teamInvites: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
      },
    },
  });

  const now = new Date();

  const data: AdminOrgData[] = orgs.map((org) => {
    const activeUsers = org.members.length;
    const pendingInvites = org.teamInvites.length;
    const usedSeats = activeUsers + pendingInvites;
    const teamAdmins = org.members.filter((m) => m.role === "TEAM_ADMIN");

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      seatLimit: org.seatLimit,
      seatPlan: org.seatPlan as UserPlan,
      stripeStatus: org.stripeStatus,
      createdAt: org.createdAt,
      activeUsers,
      pendingInvites,
      usedSeats,
      isOverLimit: usedSeats > org.seatLimit,
      teamAdmins: teamAdmins.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        plan: (m.plan ?? "PRO") as UserPlan,
        createdAt: m.createdAt,
        accountStatus: m.accountStatus,
        internalTag: m.internalTag,
        isComped: m.isComped,
      })),
      members: org.members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        plan: (m.plan ?? "PRO") as UserPlan,
        createdAt: m.createdAt,
        accountStatus: m.accountStatus,
        internalTag: m.internalTag,
        isComped: m.isComped,
      })),
    };
  });

  return { data };
}

export async function createOrganization(input: {
  name: string;
  seatLimit: number;
  seatPlan: UserPlan;
  teamAdminEmail: string;
  teamAdminName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const { name, seatLimit, seatPlan, teamAdminEmail, teamAdminName } = input;

  if (!name.trim()) return { success: false, error: "Organization name is required." };
  if (seatLimit < 1) return { success: false, error: "Seat limit must be at least 1." };
  if (!teamAdminEmail.trim() || !teamAdminEmail.includes("@")) {
    return { success: false, error: "A valid team admin email is required." };
  }

  const normalizedEmail = teamAdminEmail.trim().toLowerCase();

  // Check if the email already has an account
  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existingUser) {
    if (existingUser.role === "ADMIN") {
      return { success: false, error: "Cannot assign a global admin as a team admin." };
    }
    if (existingUser.role === "TEAM_ADMIN" && existingUser.organizationId) {
      return { success: false, error: "This user is already a team admin for another organization." };
    }
  }

  const slug = await generateUniqueSlug(name);

  // Wrap org creation + admin assignment/invite in a transaction so that
  // a failure in any step rolls back the entire operation (no orphaned org
  // or half-assigned team admin).
  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: name.trim(),
          slug,
          seatLimit,
          seatPlan,
        },
      });

      if (existingUser) {
        // Promote existing USER to TEAM_ADMIN
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            role: "TEAM_ADMIN",
            organizationId: organization.id,
            plan: seatPlan,
          },
        });
        return { organization, inviteToken: null };
      } else {
        // Create an invite token for the team admin
        const token = randomBytes(32).toString("hex");
        const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await tx.inviteToken.create({
          data: {
            email: normalizedEmail,
            token,
            expiresAt,
            plan: seatPlan,
            organizationId: organization.id,
            inviteSource: "ADMIN",
            inviteRole: "TEAM_ADMIN",
          },
        });

        return { organization, inviteToken: { token, name: organization.name } };
      }
    });

    // Send email outside the transaction — email delivery is not atomic
    // with DB state and should not hold the transaction open.
    if (result.inviteToken) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const registerUrl = `${baseUrl}/register?token=${result.inviteToken.token}`;

      const emailSent = await sendTeamInviteEmail({
        email: normalizedEmail,
        organizationName: result.inviteToken.name,
        registerUrl,
        isTeamAdminInvite: true,
      });

      if (!emailSent) {
        return {
          success: true,
          error: "Organization created and team admin invite generated, but the email failed to send. Share the registration link manually.",
        };
      }
    }

    void teamAdminName;

    return { success: true };
  } catch (err) {
    console.error("[CREATE ORG] Error:", err);
    return { success: false, error: "Failed to create organization." };
  }
}

export async function updateOrganization(
  id: string,
  input: {
    name?: string;
    seatLimit?: number;
    seatPlan?: UserPlan;
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return { success: false, error: "Organization not found." };

  const data: Record<string, unknown> = {};

  if (input.name !== undefined && input.name.trim()) {
    data.name = input.name.trim();
    data.slug = await generateUniqueSlug(input.name);
  }

  if (input.seatLimit !== undefined) {
    if (input.seatLimit < 1) return { success: false, error: "Seat limit must be at least 1." };
    data.seatLimit = input.seatLimit;
  }

  if (input.seatPlan !== undefined && input.seatPlan !== org.seatPlan) {
    data.seatPlan = input.seatPlan;
  }

  // Wrap org update + plan propagation in a transaction so that a failure
  // in plan propagation rolls back the org update (no mismatched state where
  // the org shows a new plan but members still have the old one).
  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({ where: { id }, data });

      // If seatPlan changed, propagate to all non-ADMIN org members.
      // ADMIN users are global and should keep their own plan.
      if (input.seatPlan !== undefined && input.seatPlan !== org.seatPlan) {
        await tx.user.updateMany({
          where: {
            organizationId: id,
            role: { not: "ADMIN" },
          },
          data: { plan: input.seatPlan },
        });
      }
    });

    return { success: true };
  } catch (err) {
    console.error("[UPDATE ORG] Error:", err);
    return { success: false, error: "Failed to update organization." };
  }
}

export async function assignTeamAdmin(
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { success: false, error: "Organization not found." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  if (user.role === "ADMIN") {
    return { success: false, error: "Cannot assign a global admin as a team admin." };
  }

  if (user.role === "TEAM_ADMIN" && user.organizationId && user.organizationId !== orgId) {
    return { success: false, error: "This user is already a team admin for another organization." };
  }

  // Target must already be a member of this organization
  if (user.organizationId !== orgId) {
    return { success: false, error: "The target user is not a member of this organization." };
  }

  // Find the current TEAM_ADMIN to demote them (fetch Stripe fields to clear)
  const currentAdmin = await prisma.user.findFirst({
    where: { organizationId: orgId, role: "TEAM_ADMIN" },
    select: { id: true, email: true, stripeCustomerId: true, stripeSubscriptionId: true, stripeStatus: true },
  });

  try {
    // Update Stripe customer email to the new admin BEFORE DB changes
    // so billing receipts and portal access go to the new admin
    if (org.stripeCustomerId && currentAdmin && currentAdmin.id !== userId) {
      try {
        const stripe = getStripe();
        await stripe.customers.update(org.stripeCustomerId, {
          email: user.email ?? undefined,
        });
        console.log(`[ASSIGN TEAM ADMIN] Stripe customer ${org.stripeCustomerId} email updated to ${user.email}`);
      } catch (stripeError) {
        console.error("[ASSIGN TEAM ADMIN] Failed to update Stripe customer email:", stripeError);
        // Non-fatal — DB transfer still proceeds, Stripe email can be updated later
      }
    }

    // Use sequential transaction to prevent race conditions where two
    // concurrent transfers could result in zero or multiple TEAM_ADMINs
    await prisma.$transaction(async (tx) => {
      // Demote the current admin to USER and clear any user-level Stripe
      // fields. Community subscriptions belong to the Organization, not the
      // User, so user-level Stripe fields should always be null for community
      // members. Clearing them here corrects any stale data from prior
      // invariant violations.
      if (currentAdmin && currentAdmin.id !== userId) {
        await tx.user.update({
          where: { id: currentAdmin.id },
          data: {
            role: "USER",
            stripeCustomerId: null,
            stripeSubscriptionId: null,
            stripeStatus: null,
            stripeCancelAt: null,
            stripeCurrentPeriodEnd: null,
          },
        });
      }

      // Promote the new admin. Do NOT copy org Stripe fields onto the User —
      // the community subscription is owned by the Organization. Copying them
      // would make the cancel route treat the community sub as a solo sub and
      // update the wrong record. The portal route already checks
      // Organization.stripeCustomerId for portal access.
      await tx.user.update({
        where: { id: userId },
        data: {
          role: "TEAM_ADMIN",
          plan: org.seatPlan,
        },
      });
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to assign team admin." };
  }
}

export async function promoteCoAdmin(
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return { success: false, error: "Organization not found." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  if (user.role === "ADMIN") {
    return { success: false, error: "Cannot promote a global admin to team admin." };
  }

  if (user.role === "TEAM_ADMIN" && user.organizationId === orgId) {
    return { success: false, error: "This user is already a team admin for this organization." };
  }

  if (user.role === "TEAM_ADMIN" && user.organizationId && user.organizationId !== orgId) {
    return { success: false, error: "This user is already a team admin for another organization." };
  }

  if (user.organizationId !== orgId) {
    return { success: false, error: "The target user is not a member of this organization." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "TEAM_ADMIN",
        plan: org.seatPlan,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to promote co-admin." };
  }
}

export async function deleteOrganization(
  id: string,
  confirmName: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  // Load the org with Stripe fields so we can cancel the subscription before
  // deleting the record. Once the Organization row is gone, the subscription
  // ID is lost and the subscription becomes unmanageable through the app.
  const org = await prisma.organization.findUnique({
    where: { id },
    select: { id: true, name: true, stripeSubscriptionId: true, stripeCustomerId: true },
  });
  if (!org) return { success: false, error: "Organization not found." };

  // Delegate the hardening decision (auth + typed confirmation + Stripe
  // configuration check) to the pure helper (unit-tested).
  const decision = decideOrgDelete({
    callerRole: session.user.role,
    confirmName,
    orgName: org.name,
    hasStripeSubscription: !!org.stripeSubscriptionId,
    stripeConfigured: isStripeCheckoutConfigured(),
  });
  if (decision.kind === "BLOCK") {
    return { success: false, error: decision.error };
  }

  // Cancel the active Stripe subscription BEFORE deleting the org record.
  // If cancellation fails, block deletion so the admin can retry — deleting
  // the org without canceling would orphan a paid subscription with no way
  // to manage it through the app.
  if (org.stripeSubscriptionId) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(org.stripeSubscriptionId);
      console.log(`[DELETE ORG] Cancelled Stripe subscription ${org.stripeSubscriptionId} for org ${id}`);
    } catch (err) {
      console.error("[DELETE ORG] Failed to cancel Stripe subscription:", err);
      const fail = decideAfterStripeCancelFailure("org");
      return { success: false, error: fail.error };
    }
  }

  // Wrap member downgrade + invite delete + org delete in a transaction so
  // that a partial failure doesn't leave inconsistent state (e.g. members
  // detached but org still exists, or invites orphaned).
  //
  // Members are downgraded to CALENDAR_ONLY and ARCHIVED, and their user-level
  // Stripe fields are cleared. This prevents former members from retaining
  // PRO access after the org (and its subscription) is deleted.
  //
  // Note: The InviteToken.organization relation has onDelete: Cascade, so
  // deleting the org would automatically delete invites. We do it explicitly
  // inside the transaction for clarity and to ensure ordering.
  try {
    await prisma.$transaction([
      // Downgrade and detach all members
      prisma.user.updateMany({
        where: { organizationId: id },
        data: {
          organizationId: null,
          plan: "CALENDAR_ONLY",
          accountStatus: "ARCHIVED",
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          stripeStatus: null,
        },
      }),
      // Delete pending invites for this org
      prisma.inviteToken.deleteMany({ where: { organizationId: id } }),
      // Delete the organization itself
      prisma.organization.delete({ where: { id } }),
    ]);
    return { success: true };
  } catch (err) {
    console.error("[DELETE ORG] Error:", err);
    return { success: false, error: "Failed to delete organization." };
  }
}

export interface AssignableOrg {
  id: string;
  name: string;
  slug: string | null;
  seatLimit: number;
  usedSeats: number;
  freeSeats: number;
}

/**
 * Returns organizations with at least one free seat, for the "assign user to
 * organization" picker. Counts active members + pending (unexpired) invites as
 * used seats, matching the seat accounting in `getOrganizations`.
 */
export async function getAssignableOrganizations(): Promise<{
  data?: AssignableOrg[];
  error?: string;
}> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Unauthorized" };

  const orgs = await prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { members: true } },
      teamInvites: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
      },
    },
  });

  const data: AssignableOrg[] = orgs
    .map((org) => {
      const usedSeats = org._count.members + org.teamInvites.length;
      const freeSeats = Math.max(0, org.seatLimit - usedSeats);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        seatLimit: org.seatLimit,
        usedSeats,
        freeSeats,
      };
    })
    .filter((o) => o.freeSeats > 0);

  return { data };
}

/**
 * Assigns a standalone USER to an existing organization as a regular member.
 * Does NOT promote them to TEAM_ADMIN — call `promoteCoAdmin` afterwards to
 * make them a secondary admin. Enforces seat availability and the invariants
 * documented in AGENTS.md (no global admins, no re-assignment, org must exist
 * with a free seat). Community subscription ownership stays on the
 * Organization; user-level Stripe fields are cleared defensively.
 */
export async function assignUserToOrganization(
  userId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, organizationId: true, email: true },
  });
  if (!user) return { success: false, error: "User not found." };

  if (user.role === "ADMIN") {
    return { success: false, error: "Cannot assign a global admin to an organization." };
  }
  if (user.organizationId) {
    return { success: false, error: "This user is already a member of an organization." };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: { select: { members: true } },
      teamInvites: {
        where: { expiresAt: { gt: new Date() } },
        select: { id: true },
      },
    },
  });
  if (!org) return { success: false, error: "Organization not found." };

  const usedSeats = org._count.members + org.teamInvites.length;
  if (usedSeats >= org.seatLimit) {
    return {
      success: false,
      error: `Organization is at its seat limit (${org.seatLimit}). Raise the limit or remove a member first.`,
    };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        organizationId: org.id,
        plan: org.seatPlan,
        // Defensive: community subs live on the Organization, never the User.
        // Clear any stale solo-subscription fields so billing routes don't
        // mistake a community member for a solo subscriber.
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripeStatus: null,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[ASSIGN USER TO ORG] Error:", err);
    return { success: false, error: "Failed to assign user to organization." };
  }
}
