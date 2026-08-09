/**
 * Durable, idempotent seat-reconciliation orchestration.
 *
 * Extracted from the "use server" action so it is unit-testable with injected
 * Prisma/Stripe fakes. The server action (seat-actions.ts) wires real Prisma
 * and Stripe; tests inject fakes that implement the same minimal interfaces.
 *
 * Failure model (the invariants the orchestrator preserves):
 *
 *  1. Stripe is called BEFORE any member or seatLimit mutation. If Stripe
 *     rejects or times out, no member loses access and seatLimit is unchanged.
 *     The operation is marked FAILED and is retryable with the same requestId.
 *
 *  2. If Stripe succeeds but the DB transaction fails, the orchestrator
 *     attempts to COMPENSATE by restoring the Stripe subscription to the
 *     original quantity (separate idempotency key). If compensation succeeds,
 *     the operation is FAILED (retryable, members untouched, Stripe restored).
 *
 *  3. If compensation also fails, the operation is marked RECOVERY_REQUIRED.
 *     The row preserves the original quantity and last error so an admin can
 *     reconcile manually. The orchestrator never silently converts this into a
 *     generic success.
 *
 *  4. A retry with the same requestId resumes the existing operation:
 *     - COMPLETED → returns the existing successful result.
 *     - RECOVERY_REQUIRED → returns a clear "contact support" error.
 *     - FAILED → re-claims with a new attempt and re-runs the whole flow.
 *     - fresh in-progress → returns "in progress".
 *     - stale in-progress → re-claimed with a new attempt.
 *
 *  5. The Stripe reduction uses an attempt-scoped idempotency key
 *     `seat_reconcile_main_${id}_${attempts}` so a transport retry within the
 *     same attempt does not double-charge. Compensation uses
 *     `seat_reconcile_comp_${id}_${attempts}`.
 *
 * Transaction-isolation and true concurrency guarantees require a real
 * PostgreSQL integration test (Serializable isolation, conditional
 * updateMany races). The unit tests here use injected fakes that simulate
 * the conditional-update semantics; staging concurrency QA is still required.
 */

import type { Prisma } from "@prisma/client";

// ─── Status ────────────────────────────────────────────────────────────────

export type SeatReconciliationStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED"
  | "RECOVERY_REQUIRED";

export const SEAT_RECONCILIATION_LEASE_MS = 5 * 60 * 1000;
export const MIN_SEATS = 2;
export const MAX_SEATS = 25;

// ─── Dependency interfaces (minimal, for DI) ───────────────────────────────

/** Subset of the Stripe client used by seat reconciliation. */
export interface SeatStripeClient {
  subscriptions: {
    retrieve(
      id: string
    ): Promise<{ items: { data: { id: string; quantity: number }[] } }>;
    update(
      id: string,
      params: {
        items: { id: string; quantity: number }[];
        proration_behavior: string;
        metadata?: Record<string, string>;
      },
      options?: { idempotencyKey: string }
    ): Promise<unknown>;
  };
}

/** A user row subset used during validation. */
export interface SeatValidationUser {
  id: string;
  organizationId: string | null;
  role: string;
  accountStatus: string;
}

/** Organization row subset used by the orchestrator. */
export interface SeatReconciliationOrg {
  id: string;
  name: string;
  seatLimit: number;
  stripeSubscriptionId: string | null;
}

/** Caller context produced by the auth layer (requireTeamAdminOrganization). */
export interface SeatReconciliationContext {
  userId: string;
  organizationId: string;
  organization: SeatReconciliationOrg;
}

/** Operation row shape. */
export interface SeatReconciliationOpRow {
  id: string;
  requestId: string;
  organizationId: string;
  actorUserId: string;
  originalSeatLimit: number;
  originalStripeQuantity: number | null;
  targetSeats: number;
  memberActionsJson: Prisma.JsonValue;
  status: SeatReconciliationStatus;
  attempts: number;
  claimToken: string | null;
  claimedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
}

/**
 * Minimal Prisma interface for seat reconciliation. The real Prisma client is
 * a superset; tests provide a fake implementing exactly these methods.
 */
export interface SeatReconciliationPrisma {
  $transaction<T>(
    fn: (tx: SeatReconciliationTx) => Promise<T>,
    opts?: { isolationLevel?: "Serializable" }
  ): Promise<T>;
  seatReconciliationOperation: {
    create(args: {
      data: {
        requestId: string;
        organizationId: string;
        actorUserId: string;
        originalSeatLimit: number;
        originalStripeQuantity: number | null;
        targetSeats: number;
        memberActionsJson: Prisma.InputJsonValue;
        status: SeatReconciliationStatus;
        attempts: number;
        claimToken: string;
        claimedAt: Date;
      };
    }): Promise<SeatReconciliationOpRow>;
    findUnique(args: {
      where:
        | { requestId: string }
        | { id: string };
    }): Promise<SeatReconciliationOpRow | null>;
    updateMany(args: {
      where: { id: string; claimToken?: string; status?: SeatReconciliationStatus };
      data: {
        claimToken?: string | null;
        claimedAt?: Date;
        targetSeats?: number;
        memberActionsJson?: Prisma.InputJsonValue;
        lastError?: string | null;
        originalSeatLimit?: number;
        originalStripeQuantity?: number | null;
        status?: SeatReconciliationStatus;
        completedAt?: Date | null;
        attempts?: { increment: number };
      };
    }): Promise<{ count: number }>;
  };
  user: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; organizationId: true; role: true; accountStatus: true };
    }): Promise<SeatValidationUser[]>;
    count(args: {
      where: { organizationId: string; accountStatus: { not: string } };
    }): Promise<number>;
    updateMany(args: {
      where: { id: { in: string[] } };
      data: { accountStatus?: string; organizationId?: null };
    }): Promise<{ count: number }>;
  };
  organization: {
    findUnique(args: {
      where: { id: string };
      select: { id: true; name: true; seatLimit: true; stripeSubscriptionId: true };
    }): Promise<SeatReconciliationOrg | null>;
    update(args: {
      where: { id: string };
      data: { seatLimit: number };
    }): Promise<unknown>;
  };
  inviteToken: {
    count(args: {
      where: { organizationId: string; expiresAt: { gt: Date } };
    }): Promise<number>;
  };
}

/** Transaction client — same shape as the relevant Prisma models. */
export interface SeatReconciliationTx {
  user: SeatReconciliationPrisma["user"];
  organization: SeatReconciliationPrisma["organization"];
  inviteToken: SeatReconciliationPrisma["inviteToken"];
}

export interface SeatReconciliationDeps {
  prisma: SeatReconciliationPrisma;
  /** Stripe client, or null if Stripe checkout is not configured. */
  stripe: SeatStripeClient | null;
  now?: () => Date;
  randomUUID?: () => string;
}

// ─── Result ────────────────────────────────────────────────────────────────

export type SeatReconciliationResult =
  | { success: true; newQuantity: number; resumed: boolean }
  | {
      success: false;
      error: string;
      inProgress?: boolean;
      recoveryRequired?: boolean;
    };

// ─── Pure validation ───────────────────────────────────────────────────────

export interface SeatValidationInput {
  targetSeats: number;
  orgSeatLimit: number;
  orgStripeSubscriptionId: string | null;
  expectedOrgId: string;
  actorUserId: string;
  memberActions: Record<string, "lock" | "remove">;
  selectedUsers: SeatValidationUser[];
  activeMembers: number;
  pendingInvites: number;
}

export interface SeatValidationFailure {
  error: string;
}

/**
 * Pure validation of a seat-reduction request against current DB state.
 * Returns an error string if the request is invalid, otherwise null.
 *
 * Checks (all server-side, against current state):
 *  - targetSeats is an integer within [MIN_SEATS, MAX_SEATS]
 *  - targetSeats < original seatLimit
 *  - org has a Stripe subscription
 *  - every selected user exists and belongs to the same org
 *  - no selected user is a global ADMIN or TEAM_ADMIN
 *  - the caller is not in the selection
 *  - no duplicate IDs (a Record dedupes by construction, but we assert the
 *    selected-user count matches the key count to catch a fake that returned
 *    fewer rows than IDs)
 *  - exactly the required number of members is selected
 *    (required = activeMembers - targetSeats)
 *  - pending invites are counted consistently with seat entitlement helpers;
 *    if any are outstanding, the admin must cancel them first (after a
 *    reduction to `targetSeats`, active members + invites must fit).
 */
export function validateSeatReduction(
  input: SeatValidationInput
): SeatValidationFailure | null {
  const {
    targetSeats,
    orgSeatLimit,
    orgStripeSubscriptionId,
    expectedOrgId,
    actorUserId,
    memberActions,
    selectedUsers,
    activeMembers,
    pendingInvites,
  } = input;

  if (!Number.isInteger(targetSeats) || targetSeats < MIN_SEATS) {
    return { error: `Seat count must be an integer >= ${MIN_SEATS} (minimum for Communities).` };
  }
  if (targetSeats > MAX_SEATS) {
    return { error: `Maximum ${MAX_SEATS} seats. Contact support for larger teams.` };
  }
  if (targetSeats >= orgSeatLimit) {
    return { error: "New seat count must be less than the current seat count." };
  }
  if (!orgStripeSubscriptionId) {
    return { error: "No Stripe subscription found for this organization." };
  }

  const allTargetIds = Object.keys(memberActions);
  if (allTargetIds.length === 0) {
    return { error: "Select at least one member to lock or remove." };
  }

  // Duplicate IDs: a Record cannot hold duplicate keys, but a buggy caller
  // could pass the same id under different action values via prototype
  // pollution-style input. Assert the fetched rows match the key count.
  if (selectedUsers.length !== allTargetIds.length) {
    return { error: "One or more selected members were not found." };
  }

  for (const u of selectedUsers) {
    if (u.organizationId !== expectedOrgId) {
      return { error: "You can only manage members of your own organization." };
    }
    if (u.role === "ADMIN" || u.role === "TEAM_ADMIN") {
      return { error: "You cannot lock or remove admin accounts." };
    }
    if (u.id === actorUserId) {
      return { error: "You cannot lock or remove your own account." };
    }
  }

  const requiredSelections = activeMembers - targetSeats;
  if (allTargetIds.length !== requiredSelections) {
    return {
      error:
        requiredSelections <= 0
          ? `No members need to be selected to reduce to ${targetSeats} seats.`
          : `Select exactly ${requiredSelections} member(s) to reduce to ${targetSeats} seats (you selected ${allTargetIds.length}).`,
    };
  }

  // After archiving the selected members, the remaining active members must
  // fit within targetSeats, and pending invites must not push the total over.
  const remainingActive = activeMembers - allTargetIds.length;
  if (remainingActive + pendingInvites > targetSeats) {
    return {
      error: `This organization has ${pendingInvites} pending invite(s). Cancel them before reducing seats to ${targetSeats}.`,
    };
  }

  return null;
}

// ─── Claim decision (pure) ─────────────────────────────────────────────────

export type ClaimDecision =
  | { kind: "claimed"; op: SeatReconciliationOpRow; claimToken: string }
  | { kind: "completed"; op: SeatReconciliationOpRow }
  | { kind: "recovery_required"; op: SeatReconciliationOpRow }
  | { kind: "in_progress" }
  | { kind: "param_mismatch"; existing: SeatReconciliationOpRow };

/**
 * Pure decision over an existing operation row encountered after a P2002
 * (or a re-read). Determines whether the caller may proceed, resume, or must
 * be rejected. The actual conditional updateMany (re-claim) is performed by
 * the orchestrator based on this decision.
 */
export function decideClaim(
  existing: SeatReconciliationOpRow,
  now: Date,
  leaseMs: number,
  expected: {
    organizationId: string;
    actorUserId: string;
    targetSeats: number;
  }
): ClaimDecision {
  if (existing.organizationId !== expected.organizationId) {
    return { kind: "param_mismatch", existing };
  }

  if (existing.status === "COMPLETED") {
    return { kind: "completed", op: existing };
  }
  if (existing.status === "RECOVERY_REQUIRED") {
    return { kind: "recovery_required", op: existing };
  }

  if (existing.status === "FAILED") {
    return { kind: "claimed", op: existing, claimToken: "" };
  }

  if (existing.status === "PENDING") {
    const stale =
      !existing.claimedAt ||
      now.getTime() - existing.claimedAt.getTime() > leaseMs;
    if (stale) {
      return { kind: "claimed", op: existing, claimToken: "" };
    }
    return { kind: "in_progress" };
  }

  // Unknown status — treat as in-progress (safe).
  return { kind: "in_progress" };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

/**
 * Execute (or resume) a durable seat-reduction operation.
 *
 * The caller (server action) has already authenticated the TEAM_ADMIN and
 * loaded the organization. This function performs validation against current
 * DB state, the Stripe call, the DB transaction, and compensation.
 */
export async function executeSeatReconciliation(
  deps: SeatReconciliationDeps,
  ctx: SeatReconciliationContext,
  requestId: string,
  targetSeats: number,
  memberActions: Record<string, "lock" | "remove">
): Promise<SeatReconciliationResult> {
  const { prisma, stripe } = deps;
  const now = deps.now ?? (() => new Date());
  const uuid = deps.randomUUID ?? (() => crypto.randomUUID());

  // Validate requestId format (UUID).
  if (
    !requestId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    return { success: false, error: "A valid requestId is required." };
  }

  if (!stripe) {
    return {
      success: false,
      error: "Stripe is not configured. Contact support to reduce seats.",
    };
  }

  const org = ctx.organization;
  if (!org.stripeSubscriptionId) {
    return { success: false, error: "No Stripe subscription found for this organization." };
  }

  // ── 1. Claim or resume the durable operation row ──────────────────────
  const claimToken = uuid();
  const claimNow = now();

  let op: SeatReconciliationOpRow;
  try {
    op = await prisma.seatReconciliationOperation.create({
      data: {
        requestId,
        organizationId: ctx.organizationId,
        actorUserId: ctx.userId,
        originalSeatLimit: org.seatLimit,
        originalStripeQuantity: null,
        targetSeats,
        memberActionsJson: memberActions as unknown as Prisma.InputJsonValue,
        status: "PENDING",
        attempts: 1,
        claimToken,
        claimedAt: claimNow,
      },
    });
  } catch (err) {
    // P2002 → a row with this requestId already exists; resume it.
    const code = (err as { code?: string }).code;
    if (code !== "P2002") {
      throw err;
    }
    const existing = await prisma.seatReconciliationOperation.findUnique({
      where: { requestId },
    });
    if (!existing) {
      // Vanished between P2002 and re-read — retry create.
      op = await prisma.seatReconciliationOperation.create({
        data: {
          requestId,
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          originalSeatLimit: org.seatLimit,
          originalStripeQuantity: null,
          targetSeats,
          memberActionsJson: memberActions as unknown as Prisma.InputJsonValue,
          status: "PENDING",
          attempts: 1,
          claimToken,
          claimedAt: claimNow,
        },
      });
    } else {
      const decision = decideClaim(
        existing,
        claimNow,
        SEAT_RECONCILIATION_LEASE_MS,
        {
          organizationId: ctx.organizationId,
          actorUserId: ctx.userId,
          targetSeats,
        }
      );

      if (decision.kind === "completed") {
        return { success: true, newQuantity: decision.op.targetSeats, resumed: true };
      }
      if (decision.kind === "recovery_required") {
        return {
          success: false,
          recoveryRequired: true,
          error:
            "A previous seat reduction for this request could not be safely completed or compensated. Contact support to reconcile before retrying.",
        };
      }
      if (decision.kind === "in_progress") {
        return {
          success: false,
          inProgress: true,
          error: "A seat reduction for this request is already in progress.",
        };
      }
      if (decision.kind === "param_mismatch") {
        return {
          success: false,
          error: "This request ID is already associated with a different organization.",
        };
      }

      // decision.kind === "claimed" → re-claim with a new token + attempt.
      const reClaim = await prisma.seatReconciliationOperation.updateMany({
        where: {
          id: existing.id,
          claimToken: existing.claimToken ?? undefined,
          status: existing.status,
        },
        data: {
          status: "PENDING",
          claimToken,
          claimedAt: claimNow,
          attempts: { increment: 1 },
          targetSeats,
          memberActionsJson: memberActions as unknown as Prisma.InputJsonValue,
          lastError: null,
        },
      });
      if (reClaim.count === 0) {
        // Lost the re-claim race — another worker resumed first.
        return {
          success: false,
          inProgress: true,
          error: "A seat reduction for this request is already in progress.",
        };
      }
      op = (await prisma.seatReconciliationOperation.findUnique({
        where: { id: existing.id },
      })) as SeatReconciliationOpRow;
    }
  }

  // From here, this worker holds `claimToken` on `op`.
  const attempt = op.attempts;

  // ── 2. Validate against CURRENT db state ──────────────────────────────
  const allTargetIds = Object.keys(memberActions);
  const [selectedUsers, activeMembers, pendingInvites, freshOrg] = await Promise.all([
    allTargetIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: allTargetIds } },
          select: { id: true, organizationId: true, role: true, accountStatus: true },
        })
      : Promise.resolve([]),
    prisma.user.count({
      where: { organizationId: ctx.organizationId, accountStatus: { not: "ARCHIVED" } },
    }),
    prisma.inviteToken.count({
      where: { organizationId: ctx.organizationId, expiresAt: { gt: now() } },
    }),
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      select: { id: true, name: true, seatLimit: true, stripeSubscriptionId: true },
    }),
  ]);

  if (!freshOrg) {
    await markFailed(prisma, op, claimToken, now(), "Organization not found.");
    return { success: false, error: "Organization not found." };
  }

  const validation = validateSeatReduction({
    targetSeats,
    orgSeatLimit: freshOrg.seatLimit,
    orgStripeSubscriptionId: freshOrg.stripeSubscriptionId,
    expectedOrgId: ctx.organizationId,
    actorUserId: ctx.userId,
    memberActions,
    selectedUsers,
    activeMembers,
    pendingInvites,
  });
  if (validation) {
    await markFailed(prisma, op, claimToken, now(), validation.error);
    return { success: false, error: validation.error };
  }

  // ── 3. Read the original Stripe quantity ──────────────────────────────
  let originalStripeQuantity: number | null;
  let itemId: string;
  try {
    const subscription = await stripe.subscriptions.retrieve(freshOrg.stripeSubscriptionId as string);
    const item = subscription.items.data[0];
    if (!item) {
      await markFailed(prisma, op, claimToken, now(), "Stripe subscription has no item to update.");
      return { success: false, error: "Could not find subscription item to update. Contact support." };
    }
    itemId = item.id;
    originalStripeQuantity = item.quantity;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe retrieve failed";
    await markFailed(prisma, op, claimToken, now(), msg);
    return {
      success: false,
      error: "Failed to read the Stripe subscription. Retry, or contact support.",
    };
  }

  // Persist the original quantity + fresh seatLimit on the op row (durable
  // evidence for compensation / recovery).
  await prisma.seatReconciliationOperation.updateMany({
    where: { id: op.id, claimToken, status: "PENDING" },
    data: {
      originalSeatLimit: freshOrg.seatLimit,
      originalStripeQuantity,
    },
  });

  // ── 4. Stripe reduction (attempt-scoped idempotency key) ──────────────
  const mainIdempotencyKey = `seat_reconcile_main_${op.id}_${attempt}`;
  try {
    await stripe.subscriptions.update(
      freshOrg.stripeSubscriptionId as string,
      {
        items: [{ id: itemId, quantity: targetSeats }],
        proration_behavior: "none",
        metadata: {
          purchaseType: "community",
          seatUpdate: `remove:${freshOrg.seatLimit}->${targetSeats}`,
          reconciliationOpId: op.id,
        },
      },
      { idempotencyKey: mainIdempotencyKey }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe update failed";
    // Stripe failed BEFORE any DB member change. Members untouched.
    await markFailed(prisma, op, claimToken, now(), msg);
    return {
      success: false,
      error:
        "Failed to update the Stripe subscription. No members were changed. Retry the seat reduction, or contact support.",
    };
  }

  // ── 5. DB transaction: archive/detach members + update seatLimit ──────
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

        // Re-verify the active count inside the transaction.
        const activeAfter = await tx.user.count({
          where: { organizationId: ctx.organizationId, accountStatus: { not: "ARCHIVED" } },
        });
        if (activeAfter > targetSeats) {
          throw new Error(
            `SEAT_MISMATCH: ${activeAfter} active member(s) remain after reconciliation; target is ${targetSeats}.`
          );
        }

        await tx.organization.update({
          where: { id: ctx.organizationId },
          data: { seatLimit: targetSeats },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (err) {
    // DB failed AFTER Stripe succeeded. Compensate: restore Stripe to the
    // original quantity so members (untouched) and Stripe stay consistent.
    const dbErr = err instanceof Error ? err.message : "DB transaction failed";
    const compResult = await compensateStripe(
      stripe,
      freshOrg.stripeSubscriptionId as string,
      itemId,
      originalStripeQuantity,
      op.id,
      attempt
    );

    if (compResult.ok) {
      await markFailed(
        prisma,
        op,
        claimToken,
        now(),
        `DB failed after Stripe success; compensated. DB error: ${dbErr}`
      );
      return {
        success: false,
        error:
          "Seat reduction failed after the Stripe update. Stripe was restored to the original quantity and no members were changed. Retry, or contact support.",
      };
    }

    // Compensation failed — durable recovery state. Do NOT discard evidence.
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, claimToken, status: "PENDING" },
        data: {
          status: "RECOVERY_REQUIRED",
          claimToken: null,
          lastError: `DB failed after Stripe success AND compensation failed. DB error: ${dbErr}. Comp error: ${compResult.error}. Original Stripe quantity: ${originalStripeQuantity}.`,
        },
      })
      .catch((e) => console.error("[SEAT RECONCILE] Failed to mark RECOVERY_REQUIRED:", e));

    return {
      success: false,
      recoveryRequired: true,
      error:
        "Seat reduction failed after the Stripe update and automatic compensation also failed. The operation is recorded as recovery-required. Contact support to reconcile the subscription quantity.",
    };
  }

  // ── 6. Both sides agree — mark COMPLETED ──────────────────────────────
  const completed = await prisma.seatReconciliationOperation.updateMany({
    where: { id: op.id, claimToken, status: "PENDING" },
    data: {
      status: "COMPLETED",
      claimToken: null,
      completedAt: now(),
      lastError: null,
    },
  });
  if (completed.count === 0) {
    // Lost the lease mid-operation — another worker may have resumed. The
    // member/seatLimit changes already committed; the other worker's resume
    // will see COMPLETED on its own finalization. Surface unknown outcome.
    return {
      success: false,
      error:
        "Seat reduction completed but the operation record could not be finalized. Please retry with the same request.",
    };
  }

  return { success: true, newQuantity: targetSeats, resumed: false };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function markFailed(
  prisma: SeatReconciliationPrisma,
  op: SeatReconciliationOpRow,
  claimToken: string,
  at: Date,
  error: string
): Promise<void> {
  await prisma.seatReconciliationOperation
    .updateMany({
      where: { id: op.id, claimToken, status: "PENDING" },
      data: {
        status: "FAILED",
        claimToken: null,
        lastError: error.slice(0, 2000),
      },
    })
    .catch((e) => console.error("[SEAT RECONCILE] Failed to mark op FAILED:", e));
}

async function compensateStripe(
  stripe: SeatStripeClient,
  subscriptionId: string,
  itemId: string,
  originalQuantity: number | null,
  opId: string,
  attempt: number
): Promise<{ ok: boolean; error?: string }> {
  if (originalQuantity == null) {
    // We never read the original quantity (retrieve failed before we stored
    // it). We cannot safely compensate. Treat as recovery-required.
    return { ok: false, error: "original quantity unknown" };
  }
  const compKey = `seat_reconcile_comp_${opId}_${attempt}`;
  try {
    await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: itemId, quantity: originalQuantity }],
        proration_behavior: "none",
        metadata: {
          purchaseType: "community",
          seatUpdate: `compensate:->${originalQuantity}`,
          reconciliationOpId: opId,
        },
      },
      { idempotencyKey: compKey }
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "compensation failed",
    };
  }
}
