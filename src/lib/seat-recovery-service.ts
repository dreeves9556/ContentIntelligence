/**
 * Admin recovery service for RECOVERY_REQUIRED seat-reconciliation operations.
 *
 * When a seat reduction fails after Stripe succeeded AND compensation also
 * failed, the operation is marked RECOVERY_REQUIRED. Stripe is at targetSeats,
 * the DB members/seatLimit are unchanged. An admin must intervene to reconcile.
 *
 * This module provides the production orchestration for discovering and
 * resolving those operations. It is extracted as a DI service so tests can
 * inject Prisma/Stripe fakes and exercise the real orchestration.
 *
 * Authorization: every function requires a global ADMIN caller. TEAM_ADMIN
 * and regular users are denied. The caller's role is passed as a parameter
 * (loaded from trusted server state by the server action).
 *
 * Recovery actions:
 *  - RESTORE_ORIGINAL: restore Stripe to the original quantity (DB untouched).
 *    Use when DB member changes were never committed.
 *  - COMPLETE_DB: apply the DB member/seatLimit changes (Stripe is already at
 *    target). Use when the admin wants to complete the reduction. Requires
 *    live Stripe == targetSeats AND membership state is compatible.
 *
 * Concurrency: recovery uses a conditional claim (recoveryClaimToken) so two
 * admins cannot resolve the same operation concurrently. Stale recovery claims
 * are reclaimable after a lease timeout.
 *
 * Audit trail: resolvedAt, resolvedByUserId, resolutionType, and
 * resolutionSummary are recorded. Recovery evidence is never deleted.
 */

import type { Prisma } from "@prisma/client";
import type {
  SeatReconciliationOpRow,
  SeatReconciliationPrisma,
  SeatStripeClient,
} from "./seat-reconciliation-service";

export const RECOVERY_LEASE_MS = 10 * 60 * 1000; // 10 minutes

export type RecoveryResolutionType = "RESTORE_ORIGINAL" | "COMPLETED_DB";

export interface RecoveryDeps {
  prisma: SeatReconciliationPrisma;
  stripe: SeatStripeClient | null;
  now?: () => Date;
  randomUUID?: () => string;
}

export interface RecoveryCaller {
  userId: string;
  role: string;
}

export interface RecoveryListRow {
  id: string;
  requestId: string;
  organizationId: string;
  organizationName: string | null;
  actorUserId: string;
  actorEmail: string | null;
  originalSeatLimit: number;
  originalStripeQuantity: number | null;
  targetSeats: number;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface RecoveryDetailRow extends RecoveryListRow {
  memberActionsJson: Prisma.JsonValue;
  mainIdempotencyKey: string | null;
  compensationIdempotencyKey: string | null;
  recoveryIdempotencyKey: string | null;
  recoveryClaimToken: string | null;
  recoveryClaimedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionType: string | null;
  resolutionSummary: string | null;
  stripeSubscriptionId: string | null;
}

export type RecoveryResult =
  | { success: true; resolutionType: RecoveryResolutionType; summary: string }
  | { success: false; error: string };

// ─── Authorization ──────────────────────────────────────────────────────────

export function assertAdmin(caller: RecoveryCaller): { ok: boolean; error: string | null } {
  if (caller.role !== "ADMIN") {
    return {
      ok: false,
      error: "Unauthorized: only global admins can manage seat-reconciliation recovery.",
    };
  }
  return { ok: true, error: null };
}

// ─── List RECOVERY_REQUIRED operations ──────────────────────────────────────

export async function listRecoveryRequiredOperations(
  deps: RecoveryDeps,
  caller: RecoveryCaller
): Promise<{ rows?: RecoveryListRow[]; error?: string }> {
  const auth = assertAdmin(caller);
  if (!auth.ok) return { error: auth.error! };

  const { prisma } = deps;
  // The DI interface doesn't expose findMany on seatReconciliationOperation,
  // so we use a scan via the organization index. In production, the real
  // Prisma client supports findMany; the server action uses the real client
  // directly for listing. For DI tests, the fake provides findMany.
  const ops = await (prisma as unknown as {
    seatReconciliationOperation: {
      findMany(args: {
        where: { status: string };
        orderBy: { createdAt: "desc" };
      }): Promise<SeatReconciliationOpRow[]>;
    };
  }).seatReconciliationOperation.findMany({
    where: { status: "RECOVERY_REQUIRED" },
    orderBy: { createdAt: "desc" },
  });

  // Enrich with org name and actor email (trusted server state).
  const rows: RecoveryListRow[] = [];
  for (const op of ops) {
    const org = await prisma.organization.findUnique({
      where: { id: op.organizationId },
      select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
    });
    const actor = await (prisma as unknown as {
      user: {
        findUnique(args: {
          where: { id: string };
          select: { id: true; email: true };
        }): Promise<{ id: string; email: string | null } | null>;
      };
    }).user.findUnique({
      where: { id: op.actorUserId },
      select: { id: true, email: true },
    });

    rows.push({
      id: op.id,
      requestId: op.requestId,
      organizationId: op.organizationId,
      organizationName: org?.name ?? null,
      actorUserId: op.actorUserId,
      actorEmail: actor?.email ?? null,
      originalSeatLimit: op.originalSeatLimit,
      originalStripeQuantity: op.originalStripeQuantity,
      targetSeats: op.targetSeats,
      status: op.status,
      attempts: op.attempts,
      lastError: op.lastError,
      createdAt: op.createdAt,
      updatedAt: op.updatedAt,
      resolvedAt: op.resolvedAt,
    });
  }

  return { rows };
}

// ─── Get a single recovery operation ────────────────────────────────────────

export async function getRecoveryRequiredOperation(
  deps: RecoveryDeps,
  caller: RecoveryCaller,
  opId: string
): Promise<{ row?: RecoveryDetailRow; error?: string }> {
  const auth = assertAdmin(caller);
  if (!auth.ok) return { error: auth.error! };

  const { prisma } = deps;
  const op = await prisma.seatReconciliationOperation.findUnique({
    where: { id: opId },
  });
  if (!op) return { error: "Operation not found." };
  if (op.status !== "RECOVERY_REQUIRED") {
    return { error: `Operation is not RECOVERY_REQUIRED (current: ${op.status}).` };
  }

  const org = await prisma.organization.findUnique({
    where: { id: op.organizationId },
    select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
  });

  const row: RecoveryDetailRow = {
    id: op.id,
    requestId: op.requestId,
    organizationId: op.organizationId,
    organizationName: org?.name ?? null,
    actorUserId: op.actorUserId,
    actorEmail: null,
    originalSeatLimit: op.originalSeatLimit,
    originalStripeQuantity: op.originalStripeQuantity,
    targetSeats: op.targetSeats,
    status: op.status,
    attempts: op.attempts,
    lastError: op.lastError,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
    resolvedAt: op.resolvedAt,
    memberActionsJson: op.memberActionsJson,
    mainIdempotencyKey: op.mainIdempotencyKey,
    compensationIdempotencyKey: op.compensationIdempotencyKey,
    recoveryIdempotencyKey: op.recoveryIdempotencyKey,
    recoveryClaimToken: op.recoveryClaimToken,
    recoveryClaimedAt: op.recoveryClaimedAt,
    resolvedByUserId: op.resolvedByUserId,
    resolutionType: op.resolutionType,
    resolutionSummary: op.resolutionSummary,
    stripeSubscriptionId: org?.stripeSubscriptionId ?? null,
  };

  return { row };
}

// ─── Resolve a recovery operation ───────────────────────────────────────────

export async function resolveRecoveryRequiredOperation(
  deps: RecoveryDeps,
  caller: RecoveryCaller,
  opId: string,
  resolution: RecoveryResolutionType,
  confirmation: string
): Promise<RecoveryResult> {
  const auth = assertAdmin(caller);
  if (!auth.ok) return { success: false, error: auth.error! };

  // Typed confirmation required for any mutation.
  if (confirmation !== "RESOLVE") {
    return {
      success: false,
      error: 'Confirmation required: type "RESOLVE" to confirm the recovery action.',
    };
  }

  const { prisma, stripe } = deps;
  const now = deps.now ?? (() => new Date());
  const uuid = deps.randomUUID ?? (() => crypto.randomUUID());

  if (!stripe) {
    return { success: false, error: "Stripe is not configured. Contact support." };
  }

  const op = await prisma.seatReconciliationOperation.findUnique({
    where: { id: opId },
  });
  if (!op) return { success: false, error: "Operation not found." };
  if (op.status !== "RECOVERY_REQUIRED") {
    // Idempotent replay: if already resolved, return success.
    if (op.resolutionType && op.resolvedAt) {
      return {
        success: true,
        resolutionType: op.resolutionType as RecoveryResolutionType,
        summary: op.resolutionSummary ?? "Previously resolved.",
      };
    }
    return {
      success: false,
      error: `Operation is not RECOVERY_REQUIRED (current: ${op.status}).`,
    };
  }

  if (op.originalStripeQuantity == null) {
    return {
      success: false,
      error: "Original Stripe quantity is unknown. Contact support for manual reconciliation.",
    };
  }

  // Load trusted org state.
  const org = await prisma.organization.findUnique({
    where: { id: op.organizationId },
    select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
  });
  if (!org) {
    return { success: false, error: "Organization not found. Preserve recovery evidence." };
  }
  if (!org.stripeSubscriptionId) {
    return {
      success: false,
      error: "Organization no longer has a Stripe subscription. Contact support.",
    };
  }

  // Claim the recovery operation. Only claim if no one else holds a claim
  // (recoveryClaimToken is null). If someone else holds a claim, we check
  // whether it's stale before reclaiming.
  const recoveryToken = uuid();
  const claimResult = await prisma.seatReconciliationOperation.updateMany({
    where: {
      id: op.id,
      status: "RECOVERY_REQUIRED",
      recoveryClaimToken: null,
    },
    data: {
      recoveryClaimToken: recoveryToken,
      recoveryClaimedAt: now(),
    },
  });
  if (claimResult.count === 0) {
    // Check if the existing claim is stale and reclaimable.
    const fresh = await prisma.seatReconciliationOperation.findUnique({
      where: { id: op.id },
    });
    if (!fresh || fresh.status !== "RECOVERY_REQUIRED") {
      return { success: false, error: "Operation is no longer RECOVERY_REQUIRED." };
    }
    const stale =
      !fresh.recoveryClaimedAt ||
      now().getTime() - fresh.recoveryClaimedAt.getTime() > RECOVERY_LEASE_MS;
    if (!stale) {
      return {
        success: false,
        error: "Another admin is currently resolving this operation. Wait and retry.",
      };
    }
    // Reclaim stale — match the stale token to avoid racing with another reclaim.
    const reClaim = await prisma.seatReconciliationOperation.updateMany({
      where: {
        id: op.id,
        status: "RECOVERY_REQUIRED",
        recoveryClaimToken: fresh.recoveryClaimToken,
      },
      data: {
        recoveryClaimToken: recoveryToken,
        recoveryClaimedAt: now(),
      },
    });
    if (reClaim.count === 0) {
      return {
        success: false,
        error: "Lost the recovery claim race. Retry.",
      };
    }
  }

  // From here, this admin holds recoveryToken on the op.
  // On failure, release the claim so a retry can proceed.

  let result: RecoveryResult;
  if (resolution === "RESTORE_ORIGINAL") {
    result = await executeRestoreOriginal(deps, op, org, recoveryToken, caller, now);
  } else if (resolution === "COMPLETED_DB") {
    result = await executeCompleteDb(deps, op, org, recoveryToken, caller, now);
  } else {
    result = { success: false, error: "Unknown resolution type." };
  }

  // If the resolution failed (and didn't finalize), release the recovery claim
  // so the same admin or another admin can retry.
  if (!result.success) {
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, recoveryClaimToken: recoveryToken, status: "RECOVERY_REQUIRED" },
        data: { recoveryClaimToken: null, recoveryClaimedAt: null },
      })
      .catch(() => {});
  }

  return result;
}

// ─── RESTORE_ORIGINAL: restore Stripe to original quantity ─────────────────

async function executeRestoreOriginal(
  deps: RecoveryDeps,
  op: SeatReconciliationOpRow,
  org: { id: string; name: string; seatLimit: number; stripeSubscriptionId: string | null },
  recoveryToken: string,
  caller: RecoveryCaller,
  now: () => Date
): Promise<RecoveryResult> {
  const { prisma, stripe } = deps;
  if (!stripe) return { success: false, error: "Stripe is not configured." };
  if (!org.stripeSubscriptionId) {
    return { success: false, error: "Organization has no Stripe subscription." };
  }

  const originalQuantity = op.originalStripeQuantity!;

  // Read the current Stripe state.
  let currentQuantity: number;
  let itemId: string;
  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    const item = sub.items.data[0];
    if (!item) {
      return { success: false, error: "Stripe subscription has no item." };
    }
    itemId = item.id;
    currentQuantity = item.quantity;
  } catch (err) {
    return {
      success: false,
      error: `Failed to read Stripe: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  // If Stripe is already at the original quantity, no mutation needed.
  if (currentQuantity === originalQuantity) {
    const summary = `Stripe already at original quantity ${originalQuantity}. No mutation needed. DB unchanged.`;
    await finalizeRecovery(prisma, op, recoveryToken, caller, now, "RESTORE_ORIGINAL", summary);
    return { success: true, resolutionType: "RESTORE_ORIGINAL", summary };
  }

  // Use a persisted recovery idempotency key (stable across retries).
  let recoveryKey = op.recoveryIdempotencyKey;
  if (!recoveryKey) {
    recoveryKey = `seat_reconcile_recovery_${op.id}`;
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, recoveryClaimToken: recoveryToken },
        data: { recoveryIdempotencyKey: recoveryKey },
      })
      .catch(() => {});
  }

  // Restore Stripe to the original quantity.
  try {
    await stripe.subscriptions.update(
      org.stripeSubscriptionId,
      {
        items: [{ id: itemId, quantity: originalQuantity }],
        proration_behavior: "none",
        metadata: {
          purchaseType: "community",
          seatUpdate: `recovery-restore:->${originalQuantity}`,
          reconciliationOpId: op.id,
        },
      },
      { idempotencyKey: recoveryKey }
    );
  } catch (err) {
    return {
      success: false,
      error: `Failed to restore Stripe: ${err instanceof Error ? err.message : "unknown"}. Retry with the same resolution.`,
    };
  }

  // Verify the live quantity equals the original.
  let liveQuantity: number;
  try {
    const liveSub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    liveQuantity = liveSub.items.data[0]?.quantity ?? -1;
  } catch (err) {
    return {
      success: false,
      error: `Restore may have succeeded but verification failed: ${
        err instanceof Error ? err.message : "unknown"
      }. Retry with the same resolution.`,
    };
  }
  if (liveQuantity !== originalQuantity) {
    return {
      success: false,
      error: `Stripe quantity ${liveQuantity} does not match original ${originalQuantity}. Retry with the same resolution.`,
    };
  }

  // DB members and seatLimit remain unchanged (they were never committed).
  const summary = `Restored Stripe from ${currentQuantity} to original ${originalQuantity}. DB members and seatLimit unchanged (still ${org.seatLimit}).`;
  await finalizeRecovery(prisma, op, recoveryToken, caller, now, "RESTORE_ORIGINAL", summary);
  return { success: true, resolutionType: "RESTORE_ORIGINAL", summary };
}

// ─── COMPLETED_DB: apply DB changes (Stripe is already at target) ───────────

async function executeCompleteDb(
  deps: RecoveryDeps,
  op: SeatReconciliationOpRow,
  org: { id: string; name: string; seatLimit: number; stripeSubscriptionId: string | null },
  recoveryToken: string,
  caller: RecoveryCaller,
  now: () => Date
): Promise<RecoveryResult> {
  const { prisma, stripe } = deps;
  if (!stripe) return { success: false, error: "Stripe is not configured." };
  if (!org.stripeSubscriptionId) {
    return { success: false, error: "Organization has no Stripe subscription." };
  }

  const targetSeats = op.targetSeats;

  // 1. Live Stripe quantity must equal targetSeats.
  let liveQuantity: number;
  try {
    const sub = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
    liveQuantity = sub.items.data[0]?.quantity ?? -1;
  } catch (err) {
    return {
      success: false,
      error: `Failed to read Stripe: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
  if (liveQuantity !== targetSeats) {
    return {
      success: false,
      error: `Cannot complete DB: Stripe quantity is ${liveQuantity}, expected ${targetSeats}. Use RESTORE_ORIGINAL instead.`,
    };
  }

  // 2. Current seatLimit must still be the original (DB was never committed).
  if (org.seatLimit !== op.originalSeatLimit) {
    return {
      success: false,
      error: `Cannot complete DB: org seatLimit is ${org.seatLimit}, expected original ${op.originalSeatLimit}. Membership state has drifted. Use RESTORE_ORIGINAL instead.`,
    };
  }

  // 3. Revalidate every selected member.
  const memberActions = op.memberActionsJson as Record<string, "lock" | "remove">;
  const allTargetIds = Object.keys(memberActions);
  if (allTargetIds.length === 0) {
    return { success: false, error: "No member actions recorded." };
  }

  const selectedUsers = await prisma.user.findMany({
    where: { id: { in: allTargetIds } },
    select: { id: true, organizationId: true, role: true, accountStatus: true },
  });

  // Every selected user must still exist and belong to the same org.
  if (selectedUsers.length !== allTargetIds.length) {
    return {
      success: false,
      error: "One or more selected members no longer exist. Use RESTORE_ORIGINAL instead.",
    };
  }
  for (const u of selectedUsers) {
    if (u.organizationId !== op.organizationId) {
      return {
        success: false,
        error: `Member ${u.id} no longer belongs to the organization. Use RESTORE_ORIGINAL instead.`,
      };
    }
    if (u.role === "ADMIN" || u.role === "TEAM_ADMIN") {
      return {
        success: false,
        error: `Member ${u.id} is now an admin (${u.role}). Use RESTORE_ORIGINAL instead.`,
      };
    }
  }

  // 4. Check active member count is compatible.
  const activeMembers = await prisma.user.count({
    where: { organizationId: op.organizationId, accountStatus: { not: "ARCHIVED" } },
  });
  const requiredSelections = activeMembers - targetSeats;
  if (allTargetIds.length !== requiredSelections) {
    return {
      success: false,
      error: `Membership has drifted: ${activeMembers} active members, need to select ${requiredSelections} but operation has ${allTargetIds.length}. Use RESTORE_ORIGINAL instead.`,
    };
  }

  // 5. Apply DB member actions + seatLimit atomically.
  const lockIds = Object.entries(memberActions)
    .filter(([, a]) => a === "lock")
    .map(([id]) => id);
  const removeIds = Object.entries(memberActions)
    .filter(([, a]) => a === "remove")
    .map(([id]) => id);

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

        const activeAfter = await tx.user.count({
          where: { organizationId: op.organizationId, accountStatus: { not: "ARCHIVED" } },
        });
        if (activeAfter > targetSeats) {
          throw new Error(
            `SEAT_MISMATCH: ${activeAfter} active members remain; target is ${targetSeats}.`
          );
        }

        await tx.organization.update({
          where: { id: op.organizationId },
          data: { seatLimit: targetSeats },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    return {
      success: false,
      error: `DB completion failed: ${err instanceof Error ? err.message : "unknown"}. Stripe is at ${targetSeats}. Retry with the same resolution, or use RESTORE_ORIGINAL.`,
    };
  }

  const summary = `Completed DB reconciliation: archived ${lockIds.length} member(s), detached ${removeIds.length} member(s), seatLimit ${org.seatLimit} → ${targetSeats}. Stripe was already at ${targetSeats}.`;
  await finalizeRecovery(prisma, op, recoveryToken, caller, now, "COMPLETED_DB", summary);
  return { success: true, resolutionType: "COMPLETED_DB", summary };
}

// ─── Finalize: record audit trail + transition status ───────────────────────

async function finalizeRecovery(
  prisma: SeatReconciliationPrisma,
  op: SeatReconciliationOpRow,
  recoveryToken: string,
  caller: RecoveryCaller,
  now: () => Date,
  resolutionType: RecoveryResolutionType,
  summary: string
): Promise<void> {
  await prisma.seatReconciliationOperation
    .updateMany({
      where: {
        id: op.id,
        recoveryClaimToken: recoveryToken,
        status: "RECOVERY_REQUIRED",
      },
      data: {
        status: "COMPLETED",
        recoveryClaimToken: null,
        resolvedAt: now(),
        resolvedByUserId: caller.userId,
        resolutionType,
        resolutionSummary: summary.slice(0, 2000),
        completedAt: now(),
        lastError: null,
      },
    })
    .catch((e) =>
      console.error("[SEAT RECOVERY] Failed to finalize recovery:", e)
    );
}
