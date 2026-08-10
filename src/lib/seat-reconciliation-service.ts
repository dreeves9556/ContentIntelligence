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
 *  5. The Stripe reduction uses a PERSISTED idempotency key generated once at
 *     op creation and reused across retries, stale reclaims, and unknown-outcome
 *     retries. Compensation uses a separate persisted key derived from the
 *     immutable operation ID (`seat_reconcile_comp_<op-id>`), not from the main
 *     key via string replacement. Neither key is derived from the attempt
 *     counter (which changes on stale reclaim). See migration 20260804200000
 *     for the persisted key columns.
 *
 *  6. `originalStripeQuantity` and `originalSeatLimit` are IMMUTABLE after first
 *     set. They are captured once before the first Stripe mutation and never
 *     overwritten on retry. This preserves recovery evidence.
 *
 *  7. Before applying DB changes, the orchestrator verifies the LIVE Stripe
 *     quantity equals `targetSeats`. After compensation, it verifies the live
 *     quantity equals `originalStripeQuantity`. This catches unknown-outcome
 *     crashes where Stripe may or may not have been mutated.
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
  // Persisted idempotency keys (migration 20260804200000).
  mainIdempotencyKey: string | null;
  compensationIdempotencyKey: string | null;
  // Admin recovery fields (migration 20260804200000).
  recoveryIdempotencyKey: string | null;
  recoveryClaimToken: string | null;
  recoveryClaimedAt: Date | null;
  resolvedAt: Date | null;
  resolvedByUserId: string | null;
  resolutionType: string | null;
  resolutionSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
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
        mainIdempotencyKey?: string;
      };
    }): Promise<SeatReconciliationOpRow>;
    findUnique(args: {
      where:
        | { requestId: string }
        | { id: string };
    }): Promise<SeatReconciliationOpRow | null>;
    findMany(args: {
      where: {
        status?: string;
        organizationId?: string;
        id?: { not?: string };
      };
      orderBy?: { createdAt: "desc" };
      take?: number;
      skip?: number;
    }): Promise<SeatReconciliationOpRow[]>;
    updateMany(args: {
      where: {
        id: string;
        claimToken?: string | null;
        status?: SeatReconciliationStatus;
        recoveryClaimToken?: string | null;
      };
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
        mainIdempotencyKey?: string;
        compensationIdempotencyKey?: string;
        recoveryIdempotencyKey?: string;
        recoveryClaimToken?: string | null;
        recoveryClaimedAt?: Date | null;
        resolvedAt?: Date;
        resolvedByUserId?: string;
        resolutionType?: string;
        resolutionSummary?: string;
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
  seatReconciliationOperation: {
    findMany(args: {
      where: {
        organizationId?: string;
        status?: string;
        id?: { not?: string };
      };
    }): Promise<{ id: string }[]>;
    updateMany(args: {
      where: {
        id: string;
        recoveryClaimToken?: string | null;
        status?: SeatReconciliationStatus;
      };
      data: {
        status?: SeatReconciliationStatus;
        recoveryClaimToken?: string | null;
        recoveryClaimedAt?: Date | null;
        resolvedAt?: Date;
        resolvedByUserId?: string;
        resolutionType?: string;
        resolutionSummary?: string;
        completedAt?: Date | null;
        lastError?: string | null;
      };
    }): Promise<{ count: number }>;
  };
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

// ─── Roster query (extracted for testability) ──────────────────────────────

export interface ReconcileRosterMember {
  id: string;
  role: string;
  accountStatus: string;
}

export interface ReconcileRosterPrisma {
  user: {
    findMany(args: {
      where: {
        organizationId: string;
        id?: { not: string };
        role?: { notIn: string[] };
        accountStatus?: { not: string };
      };
      select: { id: true; role: true; accountStatus: true };
      orderBy?: { createdAt: "desc" };
    }): Promise<ReconcileRosterMember[]>;
  };
}

/**
 * Query eligible members for seat reconciliation.
 * Excludes ADMIN and TEAM_ADMIN roles (they cannot be locked or removed).
 * Excludes the caller (they cannot lock/remove themselves).
 * Excludes ARCHIVED members (they are already inactive).
 */
export async function getReconcileRoster(
  prisma: ReconcileRosterPrisma,
  organizationId: string,
  callerUserId: string
): Promise<ReconcileRosterMember[]> {
  return prisma.user.findMany({
    where: {
      organizationId,
      id: { not: callerUserId },
      role: { notIn: ["ADMIN", "TEAM_ADMIN"] },
      accountStatus: { not: "ARCHIVED" },
    },
    select: { id: true, role: true, accountStatus: true },
    orderBy: { createdAt: "desc" },
  });
}

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
  // Generate the main idempotency key now so it is persisted with the op row.
  // On a retry/stale-reclaim, the existing key is reused — never derived from
  // the attempt counter (which changes on stale reclaim).
  const mainIdempotencyKey = `seat_reconcile_main_${uuid()}`;

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
        mainIdempotencyKey,
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
          mainIdempotencyKey,
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
      // CRITICAL: do NOT overwrite mainIdempotencyKey, originalStripeQuantity,
      // or originalSeatLimit — those are immutable after first set.
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
  // Use the persisted mainIdempotencyKey (from the op row, not the local var).
  const persistedMainKey = op.mainIdempotencyKey ?? mainIdempotencyKey;

  // Finding 6: Check for conflicting active operations for the same org.
  // Exclude the current operation from its own conflict check.
  const conflictingOps = await prisma.seatReconciliationOperation.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "PENDING",
      id: { not: op.id },
    },
  });
  if (conflictingOps.length > 0) {
    // Release the claim on our op so it can be retried later.
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, claimToken, status: "PENDING" },
        data: { status: "FAILED", claimToken: null, lastError: "Conflicting active reconciliation blocked start." },
      })
      .catch(() => {});
    return {
      success: false,
      error: "Another seat reconciliation is already in progress for this organization. Wait for it to complete before retrying.",
    };
  }
  // Also check for RECOVERY_REQUIRED operations (those need admin intervention first).
  const recoveryOps = await prisma.seatReconciliationOperation.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "RECOVERY_REQUIRED",
      id: { not: op.id },
    },
  });
  if (recoveryOps.length > 0) {
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, claimToken, status: "PENDING" },
        data: { status: "FAILED", claimToken: null, lastError: "Existing RECOVERY_REQUIRED blocks start." },
      })
      .catch(() => {});
    return {
      success: false,
      error: "A previous seat reconciliation for this organization requires admin recovery. Resolve it before starting a new reduction.",
    };
  }

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

  // ── 3. Read the current Stripe subscription ───────────────────────────
  let currentStripeQuantity: number | null;
  let itemId: string;
  try {
    const subscription = await stripe.subscriptions.retrieve(freshOrg.stripeSubscriptionId as string);
    const item = subscription.items.data[0];
    if (!item) {
      await markFailed(prisma, op, claimToken, now(), "Stripe subscription has no item to update.");
      return { success: false, error: "Could not find subscription item to update. Contact support." };
    }
    itemId = item.id;
    currentStripeQuantity = item.quantity;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe retrieve failed";
    await markFailed(prisma, op, claimToken, now(), msg);
    return {
      success: false,
      error: "Failed to read the Stripe subscription. Retry, or contact support.",
    };
  }

  // ── 3b. Persist original snapshot (IMMUTABLE — set only if NULL) ──────
  //
  // The original Stripe quantity is captured ONCE, before the first Stripe
  // mutation. On retry/stale-reclaim, the stored value is preserved — we
  // never overwrite it with the current (possibly already reduced) Stripe
  // quantity. This is the durable evidence for compensation and admin recovery.
  //
  // originalSeatLimit was set at create time and is never overwritten.
  if (op.originalStripeQuantity === null && currentStripeQuantity !== null) {
    const snapshotResult = await prisma.seatReconciliationOperation.updateMany({
      where: { id: op.id, claimToken, status: "PENDING" },
      data: { originalStripeQuantity: currentStripeQuantity },
    });
    if (snapshotResult.count === 0) {
      return {
        success: false,
        inProgress: true,
        error: "A seat reduction for this request is already in progress.",
      };
    }
    // Re-read the op to get the canonical stored values.
    op = (await prisma.seatReconciliationOperation.findUnique({
      where: { id: op.id },
    })) as SeatReconciliationOpRow;
  }

  // Use the STORED original values as canonical (not the local variable).
  const originalStripeQuantity = op.originalStripeQuantity;
  const originalSeatLimit = op.originalSeatLimit;

  // Validate internal consistency.
  if (originalStripeQuantity !== null && originalStripeQuantity < targetSeats) {
    await markFailed(
      prisma, op, claimToken, now(),
      `Internal inconsistency: originalStripeQuantity (${originalStripeQuantity}) < targetSeats (${targetSeats}).`
    );
    return { success: false, error: "Internal inconsistency detected. Contact support." };
  }

  // ── 4. Stripe reduction (persisted idempotency key, reused on retry) ──
  //
  // The key was generated at create time and persisted. On retry/stale-reclaim,
  // the same key is reused. If the first attempt timed out with an unknown
  // outcome, Stripe deduplicates the retry to the same logical mutation.
  try {
    await stripe.subscriptions.update(
      freshOrg.stripeSubscriptionId as string,
      {
        items: [{ id: itemId, quantity: targetSeats }],
        proration_behavior: "none",
        metadata: {
          purchaseType: "community",
          seatUpdate: `remove:${originalSeatLimit}->${targetSeats}`,
          reconciliationOpId: op.id,
        },
      },
      { idempotencyKey: persistedMainKey }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe update failed";
    await markFailed(prisma, op, claimToken, now(), msg);
    return {
      success: false,
      error:
        "Failed to update the Stripe subscription. No members were changed. Retry the seat reduction, or contact support.",
    };
  }

  // ── 4b. Verify Stripe is at targetSeats before touching the DB ────────
  let liveStripeQuantity: number;
  try {
    const liveSub = await stripe.subscriptions.retrieve(freshOrg.stripeSubscriptionId as string);
    liveStripeQuantity = liveSub.items.data[0]?.quantity ?? -1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe retrieve failed";
    await markFailed(prisma, op, claimToken, now(), `Post-update verify failed: ${msg}`);
    return {
      success: false,
      error: "Failed to verify the Stripe subscription after the update. Retry, or contact support.",
    };
  }
  if (liveStripeQuantity !== targetSeats) {
    await markFailed(
      prisma, op, claimToken, now(),
      `Stripe quantity mismatch after update: expected ${targetSeats}, got ${liveStripeQuantity}.`
    );
    return {
      success: false,
      error:
        "The Stripe subscription quantity does not match the target after the update. No members were changed. Contact support.",
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
      prisma,
      op,
      freshOrg.stripeSubscriptionId as string,
      itemId,
      originalStripeQuantity
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
  prisma: SeatReconciliationPrisma,
  op: SeatReconciliationOpRow,
  subscriptionId: string,
  itemId: string,
  originalQuantity: number | null
): Promise<{ ok: boolean; error?: string }> {
  if (originalQuantity == null) {
    return { ok: false, error: "original quantity unknown" };
  }

  // Use a persisted compensation idempotency key. Generate one if not yet
  // stored, then reuse on retry. Derived from the immutable operation ID (not
  // the main key via string replacement, and not the attempt counter) so it is
  // stable across retries and independent of the main key format.
  let compKey = op.compensationIdempotencyKey;
  if (!compKey) {
    compKey = `seat_reconcile_comp_${op.id}`;
    await prisma.seatReconciliationOperation
      .updateMany({
        where: { id: op.id, status: "PENDING" },
        data: { compensationIdempotencyKey: compKey },
      })
      .catch(() => {});
  }

  try {
    await stripe.subscriptions.update(
      subscriptionId,
      {
        items: [{ id: itemId, quantity: originalQuantity }],
        proration_behavior: "none",
        metadata: {
          purchaseType: "community",
          seatUpdate: `compensate:->${originalQuantity}`,
          reconciliationOpId: op.id,
        },
      },
      { idempotencyKey: compKey }
    );
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "compensation failed",
    };
  }

  // Verify the live Stripe quantity equals the original after compensation.
  let liveQuantity: number;
  try {
    const liveSub = await stripe.subscriptions.retrieve(subscriptionId);
    liveQuantity = liveSub.items.data[0]?.quantity ?? -1;
  } catch (err) {
    return {
      ok: false,
      error: `Compensation may have succeeded but verification failed: ${
        err instanceof Error ? err.message : "retrieve failed"
      }`,
    };
  }
  if (liveQuantity !== originalQuantity) {
    return {
      ok: false,
      error: `Stripe quantity ${liveQuantity} does not match original ${originalQuantity} after compensation`,
    };
  }

  return { ok: true };
}
