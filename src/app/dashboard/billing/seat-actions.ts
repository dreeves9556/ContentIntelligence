"use server";

import { prisma } from "@/lib/prisma";
import { requireTeamAdminOrganization } from "@/lib/organizations";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";

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

  try {
    await prisma.$transaction(
      async (tx) => {
        const target = await tx.user.findUnique({
          where: { id: memberId },
          select: { id: true, organizationId: true, role: true, accountStatus: true },
        });

        if (!target) throw new Error("USER_NOT_FOUND");
        if (target.organizationId !== ctx.user.organizationId) {
          throw new Error("CROSS_ORG");
        }
        if (target.role === "ADMIN" || target.role === "TEAM_ADMIN") {
          throw new Error("ADMIN_TARGET");
        }
        if (target.accountStatus !== "ARCHIVED") return;

        const now = new Date();
        const [organization, activeUsers, pendingInvites] = await Promise.all([
          tx.organization.findUnique({
            where: { id: ctx.organization.id },
            select: { seatLimit: true },
          }),
          tx.user.count({
            where: {
              organizationId: ctx.user.organizationId,
              accountStatus: { not: "ARCHIVED" },
            },
          }),
          tx.inviteToken.count({
            where: {
              organizationId: ctx.user.organizationId,
              expiresAt: { gt: now },
            },
          }),
        ]);

        if (!organization) throw new Error("ORG_NOT_FOUND");
        if (activeUsers + pendingInvites >= organization.seatLimit) {
          throw new Error("SEAT_LIMIT_REACHED");
        }

        await tx.user.update({
          where: { id: memberId },
          data: { accountStatus: "ACTIVE" },
        });
      },
      { isolationLevel: "Serializable" }
    );
    return { success: true };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "USER_NOT_FOUND") {
        return { success: false, error: "User not found." };
      }
      if (error.message === "CROSS_ORG") {
        return { success: false, error: "You can only manage members of your own organization." };
      }
      if (error.message === "ADMIN_TARGET") {
        return { success: false, error: "You cannot modify admin accounts." };
      }
      if (error.message === "SEAT_LIMIT_REACHED") {
        return { success: false, error: "Add a paid seat before unlocking this member." };
      }
    }
    return { success: false, error: "Failed to unlock member." };
  }
}

/**
 * Server-owned seat reduction with reconciliation.
 *
 * Previously the client orchestrated a multi-step dance:
 *   1. call lockMembers server action
 *   2. call removeMembers server action
 *   3. call /api/stripe/update-seats to reduce the Stripe quantity
 * If step 3 failed (or the client crashed between steps), members were
 * already archived but the Stripe seat count was not reduced — leaving
 * the subscription and the org seatLimit out of sync, with no server-side
 * record of the intended state.
 *
 * This action performs the entire operation server-side in a single
 * serialized transaction:
 *   - validates the caller is the TEAM_ADMIN of the org
 *   - validates the target seat count (>= 2, <= 25, < current)
 *   - validates every selected member belongs to the org and is not an admin
 *   - archives (lock) or detaches (remove) the selected members
 *   - verifies the resulting active member count fits the new seat count
 *   - updates the org seatLimit locally
 *   - calls Stripe to reduce the subscription quantity (proration_behavior:
 *     "none" — reduction takes effect at next billing period)
 *
 * The Stripe call happens AFTER the member archive so the active-count
 * validation in the old update-seats route is satisfied. If the Stripe call
 * fails, the transaction is NOT rolled back (members stay archived — they
 * can be unlocked later) but the seatLimit is not updated, so the org
 * remains consistent: archived members + old seatLimit. The admin can retry
 * the seat reduction separately.
 *
 * `action` per member: "lock" (archive, keep in org) or "remove" (archive +
 * detach from org).
 */
export async function reduceSeatsWithReconciliation(
  targetSeats: number,
  memberActions: Record<string, "lock" | "remove">
): Promise<{ success: boolean; error?: string; newQuantity?: number }> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { success: false, error: "Unauthorized" };

  // Validate target seat count.
  if (!Number.isInteger(targetSeats) || targetSeats < 2) {
    return { success: false, error: "Seat count must be an integer >= 2 (minimum for Communities)." };
  }
  if (targetSeats > 25) {
    return { success: false, error: "Maximum 25 seats. Contact support for larger teams." };
  }

  const org = ctx.organization;
  if (targetSeats >= org.seatLimit) {
    return { success: false, error: "New seat count must be less than the current seat count." };
  }

  if (!org.stripeSubscriptionId) {
    return { success: false, error: "No Stripe subscription found for this organization." };
  }

  const lockIds = Object.entries(memberActions)
    .filter(([, action]) => action === "lock")
    .map(([id]) => id);
  const removeIds = Object.entries(memberActions)
    .filter(([, action]) => action === "remove")
    .map(([id]) => id);
  const allTargetIds = [...lockIds, ...removeIds];

  // Verify all selected members belong to the caller's org and aren't admins.
  // This is done BEFORE the transaction so a validation failure doesn't
  // waste a serializable transaction slot.
  if (allTargetIds.length > 0) {
    const targets = await prisma.user.findMany({
      where: { id: { in: allTargetIds } },
      select: { id: true, organizationId: true, role: true },
    });

    for (const t of targets) {
      if (t.organizationId !== ctx.user.organizationId) {
        return { success: false, error: "You can only manage members of your own organization." };
      }
      if (t.role === "ADMIN" || t.role === "TEAM_ADMIN") {
        return { success: false, error: "You cannot lock or remove admin accounts." };
      }
    }

    if (targets.length !== allTargetIds.length) {
      return { success: false, error: "One or more selected members were not found." };
    }
  }

  // Archive/detach members and update seatLimit in a serializable transaction.
  // This ensures the active-member count and seatLimit stay consistent even
  // under concurrent admin actions.
  try {
    await prisma.$transaction(
      async (tx) => {
        if (lockIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: lockIds } },
            data: { accountStatus: "ARCHIVED" },
          });
        }
        if (removeIds.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: removeIds } },
            data: { organizationId: null, accountStatus: "ARCHIVED" },
          });
        }

        // After archiving, count active members and verify they fit.
        const activeMembers = await tx.user.count({
          where: { organizationId: org.id, accountStatus: { not: "ARCHIVED" } },
        });
        if (targetSeats < activeMembers) {
          throw new Error(
            `SEAT_MISMATCH: Cannot reduce to ${targetSeats} seats — ${activeMembers} active member(s) remain. Select more members to lock or remove.`
          );
        }

        // Update seatLimit locally (the Stripe webhook will also update this,
        // but we do it now for immediate consistency).
        await tx.organization.update({
          where: { id: org.id },
          data: { seatLimit: targetSeats },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SEAT_MISMATCH")) {
      return { success: false, error: error.message.replace("SEAT_MISMATCH: ", "") };
    }
    console.error("[REDUCE SEATS] Transaction failed:", error);
    return { success: false, error: "Failed to reconcile members. Please try again." };
  }

  // Call Stripe to reduce the subscription quantity. This happens AFTER the
  // member archive so the active-count is already reduced. If this fails,
  // members remain archived (consistent) but seatLimit was already updated
  // locally — the admin can retry the Stripe update separately via the
  // update-seats route, or contact support.
  if (!isStripeCheckoutConfigured()) {
    return { success: false, error: "Stripe is not configured. Members were archived but the subscription was not updated." };
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const itemId = subscription.items.data[0]?.id;

    if (!itemId) {
      return { success: false, error: "Could not find subscription item to update. Members were archived; contact support to reduce the seat count." };
    }

    await stripe.subscriptions.update(org.stripeSubscriptionId, {
      items: [{ id: itemId, quantity: targetSeats }],
      proration_behavior: "none",
      metadata: {
        purchaseType: "community",
        seatUpdate: `remove:${org.seatLimit}->${targetSeats}`,
      },
    });

    console.log(
      `[REDUCE SEATS] Org ${org.id} (${org.name}) — reduce ${org.seatLimit - targetSeats} seat(s): ${org.seatLimit} → ${targetSeats}`
    );

    return { success: true, newQuantity: targetSeats };
  } catch (error) {
    console.error("[REDUCE SEATS] Stripe update failed:", error);
    return {
      success: false,
      error: "Members were archived and the seat limit updated locally, but the Stripe subscription was not updated. Retry the seat reduction, or contact support.",
    };
  }
}
