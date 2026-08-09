"use server";

import { prisma } from "@/lib/prisma";
import { requireTeamAdminOrganization } from "@/lib/organizations";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";
import {
  executeSeatReconciliation,
  getReconcileRoster,
  type SeatReconciliationContext,
  type SeatReconciliationDeps,
  type SeatReconciliationPrisma,
  type SeatReconciliationResult,
  type SeatStripeClient,
} from "@/lib/seat-reconciliation-service";

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

  const roster = await getReconcileRoster(
    prisma as unknown as { user: Parameters<typeof getReconcileRoster>[0]["user"] },
    ctx.user.organizationId!,
    ctx.user.id
  );

  return {
    members: roster.map((m) => ({
      id: m.id,
      name: null,
      email: null,
      role: m.role,
      accountStatus: m.accountStatus,
      createdAt: new Date(0),
    })),
  };
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
 * Durable, idempotent seat reduction with reconciliation.
 *
 * The client generates a UUID `requestId` for each reconciliation attempt; a
 * retry with the same `requestId` resumes the existing operation rather than
 * creating a second reduction. The orchestration (Stripe-first, DB-second,
 * compensation on DB failure, durable RECOVERY_REQUIRED state) lives in
 * `src/lib/seat-reconciliation-service.ts` and is unit-tested there with
 * injected Prisma/Stripe fakes.
 *
 * Failure model (see the service module for the full state machine):
 *   - Stripe failure → no member changes, seatLimit unchanged, FAILED (retryable)
 *   - DB failure after Stripe success → Stripe compensated to original, FAILED
 *   - Compensation failure → RECOVERY_REQUIRED (admin intervenes)
 *   - Duplicate requestId → resumes existing op (COMPLETED → returns success)
 *
 * `action` per member: "lock" (archive, keep in org) or "remove" (archive +
 * detach from org).
 */
export async function reduceSeatsWithReconciliation(
  requestId: string,
  targetSeats: number,
  memberActions: Record<string, "lock" | "remove">
): Promise<SeatReconciliationResult> {
  const ctx = await requireTeamAdminOrganization();
  if (!ctx) return { success: false, error: "Unauthorized" };

  const stripe = isStripeCheckoutConfigured() ? getStripe() : null;

  const serviceCtx: SeatReconciliationContext = {
    userId: ctx.user.id,
    organizationId: ctx.user.organizationId as string,
    organization: {
      id: ctx.organization.id,
      name: ctx.organization.name,
      seatLimit: ctx.organization.seatLimit,
      stripeSubscriptionId: ctx.organization.stripeSubscriptionId,
    },
  };

  // The real Prisma + Stripe clients are structural supersets of the DI
  // interfaces; cast to satisfy the orchestrator's minimal contract.
  const deps: SeatReconciliationDeps = {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: stripe as unknown as SeatStripeClient | null,
  };

  return executeSeatReconciliation(deps, serviceCtx, requestId, targetSeats, memberActions);
}
