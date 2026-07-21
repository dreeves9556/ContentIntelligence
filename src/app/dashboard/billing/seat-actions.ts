"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireTeamAdminOrganization } from "@/lib/organizations";

/**
 * Seat reconciliation server actions.
 *
 * When a team admin reduces seats below the current member count, they must
 * select members to lock or remove. These actions enforce that the caller is
 * the TEAM_ADMIN of the org and that the target members belong to the same org.
 */

export interface ReconcileMember {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  accountStatus: string;
  createdAt: Date;
}

/**
 * Get all members of the caller's org for reconciliation purposes.
 * Excludes the caller themselves (they can't lock/remove themselves).
 */
export async function getOrgMembersForReconciliation(): Promise<{
  members?: ReconcileMember[];
  error?: string;
}> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { error: "Unauthorized" };

  const members = await prisma.user.findMany({
    where: {
      organizationId: ctx.user.organizationId,
      id: { not: ctx.user.id },
      role: { not: "ADMIN" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      accountStatus: m.accountStatus,
      createdAt: m.createdAt,
    })),
  };
}

/**
 * Lock selected members — set accountStatus to ARCHIVED. They remain in the org
 * but lose dashboard access. Can be unlocked later if seats are added back.
 */
export async function lockMembers(
  memberIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { success: false, error: "Unauthorized" };

  if (!memberIds.length) {
    return { success: false, error: "No members selected." };
  }

  // Verify all selected members belong to the caller's org and aren't admins
  const targets = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, organizationId: true, role: true },
  });

  for (const t of targets) {
    if (t.organizationId !== ctx.user.organizationId) {
      return { success: false, error: "You can only manage members of your own organization." };
    }
    if (t.role === "ADMIN" || t.role === "TEAM_ADMIN") {
      return { success: false, error: "You cannot lock admin accounts." };
    }
  }

  try {
    await prisma.user.updateMany({
      where: { id: { in: memberIds } },
      data: { accountStatus: "ARCHIVED" },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to lock members." };
  }
}

/**
 * Remove selected members from the org — set accountStatus to ARCHIVED and
 * clear organizationId. They become archived independent users, prompted to
 * subscribe to their own membership.
 */
export async function removeMembers(
  memberIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { success: false, error: "Unauthorized" };

  if (!memberIds.length) {
    return { success: false, error: "No members selected." };
  }

  // Verify all selected members belong to the caller's org and aren't admins
  const targets = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, organizationId: true, role: true },
  });

  for (const t of targets) {
    if (t.organizationId !== ctx.user.organizationId) {
      return { success: false, error: "You can only manage members of your own organization." };
    }
    if (t.role === "ADMIN" || t.role === "TEAM_ADMIN") {
      return { success: false, error: "You cannot remove admin accounts." };
    }
  }

  try {
    await prisma.user.updateMany({
      where: { id: { in: memberIds } },
      data: {
        organizationId: null,
        accountStatus: "ARCHIVED",
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove members." };
  }
}

/**
 * Unlock a previously archived member — set accountStatus back to ACTIVE.
 * Used when seats are added back and the admin wants to restore access.
 */
export async function unlockMember(
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const target = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, organizationId: true, role: true, accountStatus: true },
  });

  if (!target) return { success: false, error: "User not found." };
  if (target.organizationId !== ctx.user.organizationId) {
    return { success: false, error: "You can only manage members of your own organization." };
  }
  if (target.role === "ADMIN") {
    return { success: false, error: "You cannot modify admin accounts." };
  }

  try {
    await prisma.user.update({
      where: { id: memberId },
      data: { accountStatus: "ACTIVE" },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to unlock member." };
  }
}
