"use server";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateUniqueSlug } from "@/lib/organizations";
import { sendTeamInviteEmail } from "@/lib/invite-email";
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
  teamAdmin: AdminOrgMember | null;
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
    const teamAdmin = org.members.find((m) => m.role === "TEAM_ADMIN") ?? null;

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
      teamAdmin: teamAdmin
        ? {
            id: teamAdmin.id,
            email: teamAdmin.email,
            name: teamAdmin.name,
            role: teamAdmin.role,
            plan: (teamAdmin.plan ?? "CALENDAR_ONLY") as UserPlan,
            createdAt: teamAdmin.createdAt,
            accountStatus: teamAdmin.accountStatus,
            internalTag: teamAdmin.internalTag,
            isComped: teamAdmin.isComped,
          }
        : null,
      members: org.members.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        role: m.role,
        plan: (m.plan ?? "CALENDAR_ONLY") as UserPlan,
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

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: "TEAM_ADMIN",
        organizationId: orgId,
        plan: org.seatPlan,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to assign team admin." };
  }
}

export async function deleteOrganization(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  // Wrap member detach + invite delete + org delete in a transaction so
  // that a partial failure doesn't leave inconsistent state (e.g. members
  // detached but org still exists, or invites orphaned).
  //
  // Note: The InviteToken.organization relation has onDelete: Cascade, so
  // deleting the org would automatically delete invites. We do it explicitly
  // inside the transaction for clarity and to ensure ordering.
  try {
    await prisma.$transaction([
      // Detach all members (set organizationId to null, users keep their accounts)
      prisma.user.updateMany({
        where: { organizationId: id },
        data: { organizationId: null },
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
