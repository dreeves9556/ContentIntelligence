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

// ─── Browser-safe DTOs (no sensitive fields) ───────────────────────────────

export interface RecoveryListDTO {
  id: string;
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
  resolvedAt: Date | null;
}

export interface RecoveryDetailDTO {
  id: string;
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
  resolvedAt: Date | null;
  memberActionsJson: Prisma.JsonValue;
  resolvedByUserId: string | null;
  resolutionType: string | null;
  resolutionSummary: string | null;
}

function toRecoveryListDTO(row: RecoveryListRow): RecoveryListDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    originalSeatLimit: row.originalSeatLimit,
    originalStripeQuantity: row.originalStripeQuantity,
    targetSeats: row.targetSeats,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
  };
}

function toRecoveryDetailDTO(row: RecoveryDetailRow): RecoveryDetailDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    actorUserId: row.actorUserId,
    actorEmail: row.actorEmail,
    originalSeatLimit: row.originalSeatLimit,
    originalStripeQuantity: row.originalStripeQuantity,
    targetSeats: row.targetSeats,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    createdAt: row.createdAt,
    resolvedAt: row.resolvedAt,
    memberActionsJson: row.memberActionsJson,
    resolvedByUserId: row.resolvedByUserId,
    resolutionType: row.resolutionType,
    resolutionSummary: row.resolutionSummary,
  };
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

const RECOVERY_LIST_LIMIT = 100;

export async function listRecoveryRequiredOperations(
  deps: RecoveryDeps,
  caller: RecoveryCaller
): Promise<{ rows?: RecoveryListDTO[]; hasMore?: boolean; error?: string }> {
  const auth = assertAdmin(caller);
  if (!auth.ok) return { error: auth.error! };

  const { prisma } = deps;
  const ops = await (prisma as unknown as {
    seatReconciliationOperation: {
      findMany(args: {
        where: { status: string };
        orderBy: { createdAt: "desc" };
        take: number;
      }): Promise<SeatReconciliationOpRow[]>;
    };
  }).seatReconciliationOperation.findMany({
    where: { status: "RECOVERY_REQUIRED" },
    orderBy: { createdAt: "desc" },
    take: RECOVERY_LIST_LIMIT + 1,
  });

  const hasMore = ops.length > RECOVERY_LIST_LIMIT;
  const boundedOps = hasMore ? ops.slice(0, RECOVERY_LIST_LIMIT) : ops;

  if (boundedOps.length === 0) {
    return { rows: [], hasMore: false };
  }

  // Batch: collect unique org IDs and actor IDs, fetch in single queries.
  const orgIds = [...new Set(boundedOps.map((op) => op.organizationId))];
  const actorIds = [...new Set(boundedOps.map((op) => op.actorUserId))];

  const orgs = await (prisma as unknown as {
    organization: {
      findMany(args: {
        where: { id: { in: string[] } };
        select: { id: true; name: true; seatLimit: true; stripeSubscriptionId: true };
      }): Promise<{ id: string; name: string; seatLimit: number; stripeSubscriptionId: string | null }[]>;
    };
  }).organization.findMany({
    where: { id: { in: orgIds } },
    select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
  });

  const actors = await (prisma as unknown as {
    user: {
      findMany(args: {
        where: { id: { in: string[] } };
        select: { id: true; email: true };
      }): Promise<{ id: string; email: string | null }[]>;
    };
  }).user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, email: true },
  });

  const orgMap = new Map(orgs.map((o) => [o.id, o]));
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const rows: RecoveryListDTO[] = boundedOps.map((op) => {
    const org = orgMap.get(op.organizationId);
    const actor = actorMap.get(op.actorUserId);
    return toRecoveryListDTO({
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
  });

  return { rows, hasMore };
}

// ─── Get a single recovery operation ────────────────────────────────────────

export async function getRecoveryRequiredOperation(
  deps: RecoveryDeps,
  caller: RecoveryCaller,
  opId: string
): Promise<{ row?: RecoveryDetailDTO; error?: string }> {
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

  return { row: toRecoveryDetailDTO(row) };
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

  // Finding 6: Check for conflicting active operations for the same org.
  // Exclude the current operation from its own conflict check.
  const conflictingOps = await prisma.seatReconciliationOperation.findMany({
    where: {
      organizationId: op.organizationId,
      status: "PENDING",
      id: { not: op.id },
    },
  });
  if (conflictingOps.length > 0) {
    return {
      success: false,
      error: `Cannot resolve: another active reconciliation (PENDING) exists for this organization. Resolve or wait for it first.`,
    };
  }
  // Also check for other RECOVERY_REQUIRED operations (excluding this one).
  const otherRecoveryOps = await prisma.seatReconciliationOperation.findMany({
    where: {
      organizationId: op.organizationId,
      status: "RECOVERY_REQUIRED",
      id: { not: op.id },
    },
  });
  if (otherRecoveryOps.length > 0) {
    return {
      success: false,
      error: `Cannot resolve: another RECOVERY_REQUIRED operation exists for this organization. Resolve it first.`,
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

  // Finding 3: Verify DB reconciliation was not already applied.
  // If seatLimit has changed from the original, DB changes were committed.
  if (org.seatLimit !== op.originalSeatLimit) {
    return {
      success: false,
      error: `Cannot restore: DB seatLimit is ${org.seatLimit}, expected original ${op.originalSeatLimit}. DB reconciliation may have already been applied. Review DB state or finalize as COMPLETED_DB.`,
    };
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
  // On retry after a failed finalization, this path retries only finalization.
  if (currentQuantity === originalQuantity) {
    const summary = `Stripe already at original quantity ${originalQuantity}. No mutation needed. DB unchanged.`;
    const finResult = await finalizeRecoveryAtomic(
      prisma, op, recoveryToken, caller, now, "RESTORE_ORIGINAL", summary
    );
    if (!finResult.ok) {
      return { success: false, error: finResult.error! };
    }
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

  // Finding 3: Token-scoped finalization in a serializable transaction.
  // Do not swallow errors. If finalization fails, return failure.
  const summary = `Restored Stripe from ${currentQuantity} to original ${originalQuantity}. DB members and seatLimit unchanged (still ${org.seatLimit}).`;
  const finResult = await finalizeRecoveryAtomic(
    prisma, op, recoveryToken, caller, now, "RESTORE_ORIGINAL", summary
  );
  if (!finResult.ok) {
    return { success: false, error: finResult.error! };
  }
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

  // 1. Live Stripe quantity must equal targetSeats (checked before the DB tx).
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

  // 3. Revalidate every selected member (before the transaction).
  const memberActions = op.memberActionsJson as Record<string, "lock" | "remove">;
  const allTargetIds = Object.keys(memberActions);
  if (allTargetIds.length === 0) {
    return { success: false, error: "No member actions recorded." };
  }

  const selectedUsers = await prisma.user.findMany({
    where: { id: { in: allTargetIds } },
    select: { id: true, organizationId: true, role: true, accountStatus: true },
  });

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

  // 4. Check active member count is compatible (before the transaction).
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

  // 5. Apply DB member actions + seatLimit + finalization atomically.
  const lockIds = Object.entries(memberActions)
    .filter(([, a]) => a === "lock")
    .map(([id]) => id);
  const removeIds = Object.entries(memberActions)
    .filter(([, a]) => a === "remove")
    .map(([id]) => id);

  let summary = "";
  try {
    await prisma.$transaction(
      async (tx) => {
        // Finding 1+2: Re-run all validation inside the serializable transaction
        // so it cannot become stale before commit.

        // Revalidate org state inside the tx.
        const orgInTx = await tx.organization.findUnique({
          where: { id: op.organizationId },
          select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
        });
        if (!orgInTx) {
          throw new Error("Organization not found inside transaction.");
        }
        if (orgInTx.seatLimit !== op.originalSeatLimit) {
          throw new Error(
            `SEAT_LIMIT_DRIFTED: seatLimit is ${orgInTx.seatLimit}, expected ${op.originalSeatLimit}.`
          );
        }

        // Revalidate members inside the tx.
        const usersInTx = await tx.user.findMany({
          where: { id: { in: allTargetIds } },
          select: { id: true, organizationId: true, role: true, accountStatus: true },
        });
        if (usersInTx.length !== allTargetIds.length) {
          throw new Error("MEMBER_MISSING: A selected member no longer exists.");
        }
        for (const u of usersInTx) {
          if (u.organizationId !== op.organizationId) {
            throw new Error(`MEMBER_DRIFTED: Member ${u.id} left the organization.`);
          }
          if (u.role === "ADMIN" || u.role === "TEAM_ADMIN") {
            throw new Error(`MEMBER_PROMOTED: Member ${u.id} is now an admin.`);
          }
        }

        // Finding 1: Count active members inside the tx.
        const activeInTx = await tx.user.count({
          where: { organizationId: op.organizationId, accountStatus: { not: "ARCHIVED" } },
        });
        const requiredInTx = activeInTx - targetSeats;
        if (allTargetIds.length !== requiredInTx) {
          throw new Error(
            `MEMBERSHIP_DRIFTED: ${activeInTx} active members, need ${requiredInTx} selections, have ${allTargetIds.length}.`
          );
        }

        // Finding 1: Count pending invites inside the tx.
        const pendingInvitesInTx = await tx.inviteToken.count({
          where: {
            organizationId: op.organizationId,
            expiresAt: { gt: now() },
          },
        });

        // Apply member changes.
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

        // Count remaining active members after changes.
        const activeAfter = await tx.user.count({
          where: { organizationId: op.organizationId, accountStatus: { not: "ARCHIVED" } },
        });

        // Finding 1: remaining active members + pending invites <= targetSeats.
        if (activeAfter + pendingInvitesInTx > targetSeats) {
          throw new Error(
            `SEAT_LIMIT_EXCEEDED: ${activeAfter} active members + ${pendingInvitesInTx} pending invites = ${activeAfter + pendingInvitesInTx} > targetSeats ${targetSeats}. Cancel pending invites before completing.`
          );
        }

        if (activeAfter > targetSeats) {
          throw new Error(
            `SEAT_MISMATCH: ${activeAfter} active members remain; target is ${targetSeats}.`
          );
        }

        // Update seatLimit.
        await tx.organization.update({
          where: { id: op.organizationId },
          data: { seatLimit: targetSeats },
        });

        // Finding 2: Token-scoped operation finalization inside the same tx.
        // Require exactly 1 row affected; otherwise roll back everything.
        const finResult = await tx.seatReconciliationOperation.updateMany({
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
            resolutionType: "COMPLETED_DB",
            resolutionSummary: "", // filled below
            completedAt: now(),
            lastError: null,
          },
        });
        if (finResult.count !== 1) {
          throw new Error(
            "FINALIZATION_FAILED: Token-scoped finalization affected 0 rows. Recovery claim lost or status changed."
          );
        }

        summary = `Completed DB reconciliation: archived ${lockIds.length} member(s), detached ${removeIds.length} member(s), seatLimit ${org.seatLimit} → ${targetSeats}. Stripe was already at ${targetSeats}. Pending invites: ${pendingInvitesInTx}.`;

        // Update the summary now that we know the final state.
        await tx.seatReconciliationOperation.updateMany({
          where: { id: op.id },
          data: { resolutionSummary: summary.slice(0, 2000) },
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

  return { success: true, resolutionType: "COMPLETED_DB", summary };
}

// ─── Atomic finalization (no error swallowing) ──────────────────────────────

async function finalizeRecoveryAtomic(
  prisma: SeatReconciliationPrisma,
  op: SeatReconciliationOpRow,
  recoveryToken: string,
  caller: RecoveryCaller,
  now: () => Date,
  resolutionType: RecoveryResolutionType,
  summary: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const finResult = await tx.seatReconciliationOperation.updateMany({
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
        });
        if (finResult.count !== 1) {
          throw new Error(
            "FINALIZATION_FAILED: Token-scoped finalization affected 0 rows. Recovery claim lost or status changed."
          );
        }
        return finResult;
      },
      { isolationLevel: "Serializable" }
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: `Recovery finalization failed: ${err instanceof Error ? err.message : "unknown"}. Retry with the same resolution.`,
    };
  }
}
