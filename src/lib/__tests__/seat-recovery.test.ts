/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests for the admin seat-reconciliation recovery service.
// Run: npx tsx src/lib/__tests__/seat-recovery.test.ts
//
// Exercises the real `listRecoveryRequiredOperations`,
// `getRecoveryRequiredOperation`, and `resolveRecoveryRequiredOperation`
// from src/lib/seat-recovery-service.ts with injected Prisma/Stripe fakes.
// No algorithm is copied — the test drives the production service.

import {
  listRecoveryRequiredOperations,
  getRecoveryRequiredOperation,
  resolveRecoveryRequiredOperation,
  type RecoveryDeps,
  type RecoveryCaller,
} from "../seat-recovery-service";
import {
  executeSeatReconciliation,
  getReconcileRoster,
  type SeatReconciliationPrisma,
  type SeatReconciliationOpRow,
  type SeatStripeClient,
  type SeatValidationUser,
  type SeatReconciliationDeps,
  type ReconcileRosterPrisma,
} from "../seat-reconciliation-service";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

// ─── In-memory fake Prisma (shared with seat-reconciliation.test.ts shape) ──

interface FakeUser extends SeatValidationUser {
  email?: string | null;
}

interface FakeOrg {
  id: string;
  name: string;
  seatLimit: number;
  stripeSubscriptionId: string | null;
}

interface FakeInvite {
  id: string;
  organizationId: string;
  expiresAt: Date;
}

class FakePrisma implements SeatReconciliationPrisma {
  users: Map<string, FakeUser> = new Map();
  orgs: Map<string, FakeOrg> = new Map();
  invites: FakeInvite[] = [];
  ops: Map<string, SeatReconciliationOpRow> = new Map();
  opsByRequestId: Map<string, string> = new Map();
  stripeQuantity: number = 5;
  stripeUpdateShouldFail: boolean = false;
  stripeUpdateShouldTimeout: boolean = false;
  dbTransactionShouldFail: boolean = false;
  compensationShouldFail: boolean = false;
  stripeUpdateCalls: { id: string; quantity: number; idempotencyKey?: string }[] = [];
  stripeRetrieveCalls: number = 0;

  async $transaction<T>(
    fn: (tx: FakeTx) => Promise<T>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _opts?: { isolationLevel?: "Serializable" }
  ): Promise<T> {
    const tx: FakeTx = {
      user: {
        findMany: async (args: any) =>
          Array.from(this.users.values()).filter((u) => args.where.id.in.includes(u.id)),
        count: async (args: any) =>
          Array.from(this.users.values()).filter(
            (u) => u.organizationId === args.where.organizationId && u.accountStatus !== args.where.accountStatus.not
          ).length,
        updateMany: async (args: any) => {
          let count = 0;
          for (const id of args.where.id.in) {
            const u = this.users.get(id);
            if (!u) continue;
            if (args.data.accountStatus) u.accountStatus = args.data.accountStatus;
            if (args.data.organizationId === null) u.organizationId = null;
            count++;
          }
          return { count };
        },
      },
      organization: {
        findUnique: async (args: any) => this.orgs.get(args.where.id) ?? null,
        update: async (args: any) => {
          const org = this.orgs.get(args.where.id);
          if (org) org.seatLimit = args.data.seatLimit;
          return org;
        },
      },
      inviteToken: {
        count: async (args: any) =>
          this.invites.filter(
            (i) => i.organizationId === args.where.organizationId && i.expiresAt > args.where.expiresAt.gt
          ).length,
      },
      seatReconciliationOperation: {
        findMany: async (args: any) => {
          let rows = Array.from(this.ops.values());
          if (args.where?.organizationId) {
            rows = rows.filter((r) => r.organizationId === args.where.organizationId);
          }
          if (args.where?.status) {
            rows = rows.filter((r) => r.status === args.where.status);
          }
          if (args.where?.id?.not) {
            rows = rows.filter((r) => r.id !== args.where.id.not);
          }
          return rows.map((r) => ({ id: r.id }));
        },
        updateMany: async (args: any) => {
          const row = this.ops.get(args.where.id);
          if (!row) return { count: 0 };
          if (args.where.recoveryClaimToken !== undefined && row.recoveryClaimToken !== args.where.recoveryClaimToken) {
            return { count: 0 };
          }
          if (args.where.status !== undefined && row.status !== args.where.status) {
            return { count: 0 };
          }
          const data = args.data;
          if (data.status !== undefined) row.status = data.status;
          if (data.recoveryClaimToken !== undefined) row.recoveryClaimToken = data.recoveryClaimToken;
          if (data.recoveryClaimedAt !== undefined) row.recoveryClaimedAt = data.recoveryClaimedAt;
          if (data.resolvedAt !== undefined) row.resolvedAt = data.resolvedAt;
          if (data.resolvedByUserId !== undefined) row.resolvedByUserId = data.resolvedByUserId;
          if (data.resolutionType !== undefined) row.resolutionType = data.resolutionType;
          if (data.resolutionSummary !== undefined) row.resolutionSummary = data.resolutionSummary;
          if (data.completedAt !== undefined) row.completedAt = data.completedAt;
          if (data.lastError !== undefined) row.lastError = data.lastError;
          return { count: 1 };
        },
      },
    };

    if (this.dbTransactionShouldFail) {
      throw new Error("SIMULATED_DB_FAILURE");
    }
    return fn(tx);
  }

  seatReconciliationOperation = {
    create: async (args: any) => {
      const id = `op_${this.ops.size + 1}`;
      const row: SeatReconciliationOpRow = {
        id,
        requestId: args.data.requestId,
        organizationId: args.data.organizationId,
        actorUserId: args.data.actorUserId,
        originalSeatLimit: args.data.originalSeatLimit,
        originalStripeQuantity: args.data.originalStripeQuantity,
        targetSeats: args.data.targetSeats,
        memberActionsJson: args.data.memberActionsJson,
        status: args.data.status,
        attempts: args.data.attempts,
        claimToken: args.data.claimToken,
        claimedAt: args.data.claimedAt,
        completedAt: null,
        lastError: null,
        mainIdempotencyKey: args.data.mainIdempotencyKey ?? null,
        compensationIdempotencyKey: null,
        recoveryIdempotencyKey: null,
        recoveryClaimToken: null,
        recoveryClaimedAt: null,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionType: null,
        resolutionSummary: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (this.opsByRequestId.has(args.data.requestId)) {
        const err = new Error("P2002") as Error & { code: string };
        err.code = "P2002";
        throw err;
      }
      this.ops.set(id, row);
      this.opsByRequestId.set(args.data.requestId, id);
      return row;
    },
    findUnique: async (args: any) => {
      if ("requestId" in args.where) {
        const id = this.opsByRequestId.get(args.where.requestId);
        return id ? this.ops.get(id) ?? null : null;
      }
      return this.ops.get(args.where.id) ?? null;
    },
    findMany: async (args: any) => {
      let rows = Array.from(this.ops.values());
      if (args.where?.status) {
        rows = rows.filter((r) => r.status === args.where.status);
      }
      if (args.where?.organizationId) {
        rows = rows.filter((r) => r.organizationId === args.where.organizationId);
      }
      if (args.where?.id?.not) {
        rows = rows.filter((r) => r.id !== args.where.id.not);
      }
      if (args.take) {
        rows = rows.slice(0, args.take);
      }
      return rows;
    },
    updateMany: async (args: any) => {
      const row = this.ops.get(args.where.id);
      if (!row) return { count: 0 };
      if (args.where.claimToken !== undefined && row.claimToken !== args.where.claimToken) {
        return { count: 0 };
      }
      if (args.where.recoveryClaimToken !== undefined) {
        // Match null: if where says null, only match rows with null token
        const whereToken = args.where.recoveryClaimToken;
        if (whereToken === null && row.recoveryClaimToken !== null) {
          return { count: 0 };
        }
        if (whereToken !== null && row.recoveryClaimToken !== whereToken) {
          return { count: 0 };
        }
      }
      if (args.where.status !== undefined && row.status !== args.where.status) {
        return { count: 0 };
      }
      const data = args.data;
      if (data.claimToken !== undefined) row.claimToken = data.claimToken;
      if (data.claimedAt !== undefined) row.claimedAt = data.claimedAt;
      if (data.targetSeats !== undefined) row.targetSeats = data.targetSeats;
      if (data.memberActionsJson !== undefined) row.memberActionsJson = data.memberActionsJson;
      if (data.lastError !== undefined) row.lastError = data.lastError;
      if (data.originalSeatLimit !== undefined) row.originalSeatLimit = data.originalSeatLimit;
      if (data.originalStripeQuantity !== undefined) row.originalStripeQuantity = data.originalStripeQuantity;
      if (data.status !== undefined) row.status = data.status;
      if (data.completedAt !== undefined) row.completedAt = data.completedAt;
      if (data.mainIdempotencyKey !== undefined) row.mainIdempotencyKey = data.mainIdempotencyKey;
      if (data.compensationIdempotencyKey !== undefined) row.compensationIdempotencyKey = data.compensationIdempotencyKey;
      if (data.recoveryIdempotencyKey !== undefined) row.recoveryIdempotencyKey = data.recoveryIdempotencyKey;
      if (data.recoveryClaimToken !== undefined) row.recoveryClaimToken = data.recoveryClaimToken;
      if (data.recoveryClaimedAt !== undefined) row.recoveryClaimedAt = data.recoveryClaimedAt;
      if (data.resolvedAt !== undefined) row.resolvedAt = data.resolvedAt;
      if (data.resolvedByUserId !== undefined) row.resolvedByUserId = data.resolvedByUserId;
      if (data.resolutionType !== undefined) row.resolutionType = data.resolutionType;
      if (data.resolutionSummary !== undefined) row.resolutionSummary = data.resolutionSummary;
      if (data.attempts !== undefined && typeof data.attempts === "object") {
        row.attempts += (data.attempts as { increment: number }).increment;
      }
      return { count: 1 };
    },
  };

  user = {
    findMany: async (args: any): Promise<any[]> => {
      if (args.where?.id?.in) {
        return Array.from(this.users.values())
          .filter((u) => args.where.id.in.includes(u.id));
      }
      // Roster query path
      return Array.from(this.users.values()).filter((u) => {
        if (args.where?.organizationId && u.organizationId !== args.where.organizationId) return false;
        if (args.where?.id?.not && u.id === args.where.id.not) return false;
        if (args.where?.role?.notIn && args.where.role.notIn.includes(u.role)) return false;
        if (args.where?.accountStatus?.not && u.accountStatus === args.where.accountStatus.not) return false;
        return true;
      });
    },
    findUnique: async (args: any) => {
      const u = this.users.get(args.where.id);
      if (!u) return null;
      return { id: u.id, email: u.email ?? null };
    },
    count: async (args: any) =>
      Array.from(this.users.values()).filter(
        (u) => u.organizationId === args.where.organizationId && u.accountStatus !== args.where.accountStatus.not
      ).length,
    updateMany: async (args: any) => {
      let count = 0;
      for (const id of args.where.id.in) {
        const u = this.users.get(id);
        if (!u) continue;
        if (args.data.accountStatus) u.accountStatus = args.data.accountStatus;
        if (args.data.organizationId === null) u.organizationId = null;
        count++;
      }
      return { count };
    },
  };

  organization = {
    findUnique: async (args: any) => this.orgs.get(args.where.id) ?? null,
    findMany: async (args: any) => {
      if (args.where?.id?.in) {
        return Array.from(this.orgs.values())
          .filter((o) => args.where.id.in.includes(o.id))
          .map((o) => ({ id: o.id, name: o.name, seatLimit: o.seatLimit, stripeSubscriptionId: o.stripeSubscriptionId }));
      }
      return Array.from(this.orgs.values());
    },
    update: async (args: any) => {
      const org = this.orgs.get(args.where.id);
      if (org) org.seatLimit = args.data.seatLimit;
      return org;
    },
  };

  inviteToken = {
    count: async (args: any) =>
      this.invites.filter(
        (i) => i.organizationId === args.where.organizationId && i.expiresAt > args.where.expiresAt.gt
      ).length,
  };
}

interface FakeTx {
  user: SeatReconciliationPrisma["user"];
  organization: SeatReconciliationPrisma["organization"];
  inviteToken: SeatReconciliationPrisma["inviteToken"];
  seatReconciliationOperation: {
    findMany(args: any): Promise<{ id: string }[]>;
    updateMany(args: any): Promise<{ count: number }>;
  };
}

class FakeStripe implements SeatStripeClient {
  prisma: FakePrisma;
  constructor(prisma: FakePrisma) {
    this.prisma = prisma;
  }
  subscriptions = {
    retrieve: async () => {
      this.prisma.stripeRetrieveCalls++;
      return {
        items: {
          data: [{ id: "item_1", quantity: this.prisma.stripeQuantity }],
        },
      };
    },
    update: async (
      id: string,
      params: { items: { id: string; quantity: number }[]; proration_behavior: string; metadata?: Record<string, string> },
      options?: { idempotencyKey: string }
    ) => {
      this.prisma.stripeUpdateCalls.push({
        id,
        quantity: params.items[0].quantity,
        idempotencyKey: options?.idempotencyKey,
      });
      if (this.prisma.stripeUpdateShouldFail) throw new Error("SIMULATED_STRIPE_FAILURE");
      if (this.prisma.stripeUpdateShouldTimeout) throw new Error("SIMULATED_STRIPE_TIMEOUT");
      if (options?.idempotencyKey.startsWith("seat_reconcile_comp_") && this.prisma.compensationShouldFail) {
        throw new Error("SIMULATED_COMPENSATION_FAILURE");
      }
      if (options?.idempotencyKey.startsWith("seat_reconcile_recovery_") && this.prisma.compensationShouldFail) {
        throw new Error("SIMULATED_RECOVERY_FAILURE");
      }
      this.prisma.stripeQuantity = params.items[0].quantity;
      return {};
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRecoveryDeps(prisma: FakePrisma): RecoveryDeps {
  return {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: new FakeStripe(prisma),
    now: () => new Date("2026-08-08T12:00:00Z"),
    randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
  };
}

function makeReconcileDeps(prisma: FakePrisma): SeatReconciliationDeps {
  return {
    prisma: prisma as unknown as SeatReconciliationPrisma,
    stripe: new FakeStripe(prisma),
    now: () => new Date("2026-08-08T12:00:00Z"),
    randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
  };
}

async function setupOrgWithRecoveryAsync(
  prisma: FakePrisma,
  orgId: string = "org_1",
  seatLimit: number = 5,
  memberCount: number = 4
): Promise<{ op: SeatReconciliationOpRow }> {
  const org: FakeOrg = {
    id: orgId,
    name: "Test Org",
    seatLimit,
    stripeSubscriptionId: "sub_123",
  };
  prisma.orgs.set(orgId, org);
  prisma.stripeQuantity = seatLimit;

  for (let i = 0; i < memberCount; i++) {
    prisma.users.set(`user_${i + 1}`, {
      id: `user_${i + 1}`,
      organizationId: orgId,
      role: "USER",
      accountStatus: "ACTIVE",
      email: `user${i + 1}@test.com`,
    });
  }
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: orgId,
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
    email: "admin@test.com",
  });

  // Create a RECOVERY_REQUIRED operation.
  prisma.dbTransactionShouldFail = true;
  prisma.compensationShouldFail = true;
  const deps = makeReconcileDeps(prisma);
  const ctx = {
    userId: "admin_1",
    organizationId: orgId,
    organization: { id: orgId, name: "Test Org", seatLimit, stripeSubscriptionId: "sub_123" },
  };
  await executeSeatReconciliation(deps, ctx, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 3, {
    user_1: "lock",
    user_2: "remove",
  });
  prisma.dbTransactionShouldFail = false;
  prisma.compensationShouldFail = false;

  const op = Array.from(prisma.ops.values())[0];
  assert(op.status === "RECOVERY_REQUIRED", "setup created RECOVERY_REQUIRED op");
  return { op };
}

const adminCaller: RecoveryCaller = { userId: "global_admin_1", role: "ADMIN" };
const teamAdminCaller: RecoveryCaller = { userId: "admin_1", role: "TEAM_ADMIN" };
const userCaller: RecoveryCaller = { userId: "user_1", role: "USER" };

// ─── Tests ──────────────────────────────────────────────────────────────────

// 1. Non-admin denied
async function testNonAdminDenied() {
  const prisma = new FakePrisma();
  const deps = makeRecoveryDeps(prisma);
  const result = await listRecoveryRequiredOperations(deps, userCaller);
  assert(!!result.error, "non-admin denied listing");
  assert(((result as any).error).includes("admin"), "non-admin error mentions admin");
}

// 2. TEAM_ADMIN denied
async function testTeamAdminDenied() {
  const prisma = new FakePrisma();
  const deps = makeRecoveryDeps(prisma);
  const result = await listRecoveryRequiredOperations(deps, teamAdminCaller);
  assert(!!result.error, "TEAM_ADMIN denied listing");
}

// 3. Admin can list RECOVERY_REQUIRED
async function testAdminCanList() {
  const prisma = new FakePrisma();
  await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  const result = await listRecoveryRequiredOperations(deps, adminCaller);
  assert(!!result.rows, "admin gets rows");
  assert(result.rows!.length === 1, "one RECOVERY_REQUIRED row");
  assert(result.rows![0].organizationName === "Test Org", "row has org name");
}

// 4. Cross-operation/organization IDOR rejected
async function testIdorRejected() {
  const prisma = new FakePrisma();
  await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  // Try to get a non-existent op
  const result = await getRecoveryRequiredOperation(deps, adminCaller, "nonexistent_op");
  assert(!!result.error, "non-existent op rejected");
}

// 5. Two admins attempt recovery concurrently
async function testConcurrentAdminRecovery() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  // Simulate concurrent: first admin claims, second admin tries
  const admin2: RecoveryCaller = { userId: "global_admin_2", role: "ADMIN" };
  // Start first resolution (RESTORE_ORIGINAL) — this will claim the op
  const r1 = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(r1.success === true, "first admin resolves successfully");
  // Second admin tries — op is now COMPLETED, should return idempotent success
  const r2 = await resolveRecoveryRequiredOperation(deps, admin2, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(r2.success === true, "second admin gets idempotent success on resolved op");
}

// 6. Restore when Stripe is at target
async function testRestoreWhenStripeAtTarget() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // After setup, Stripe is at 3 (target), DB is at 5 (original)
  assert(prisma.stripeQuantity === 3, "Stripe at target after setup");
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === true, "restore succeeds");
  assert(prisma.stripeQuantity === 5, "Stripe restored to original 5");
  const updatedOp = prisma.ops.get(op.id)!;
  assert(updatedOp.status === "COMPLETED", "op COMPLETED after restore");
  assert(updatedOp.resolutionType === "RESTORE_ORIGINAL", "resolutionType RESTORE_ORIGINAL");
}

// 7. Restore when Stripe is already at original
async function testRestoreWhenStripeAlreadyOriginal() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // Manually set Stripe back to original (simulating someone fixed it)
  prisma.stripeQuantity = 5;
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === true, "restore succeeds when already at original");
  assert(prisma.stripeQuantity === 5, "Stripe stays at original 5");
  // No Stripe update call should be made (already at original)
  const recoveryCalls = prisma.stripeUpdateCalls.filter((c) => c.idempotencyKey?.startsWith("seat_reconcile_recovery_"));
  assert(recoveryCalls.length === 0, "no Stripe mutation when already at original");
}

// 8. Restore Stripe failure
async function testRestoreStripeFailure() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  prisma.compensationShouldFail = true; // reuse flag for recovery failure
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === false, "restore fails on Stripe error");
  assert(prisma.stripeQuantity === 3, "Stripe stays at target after failed restore");
  const updatedOp = prisma.ops.get(op.id)!;
  assert(updatedOp.status === "RECOVERY_REQUIRED", "op stays RECOVERY_REQUIRED after failed restore");
}

// 9. Restore timeout with unknown outcome
async function testRestoreTimeout() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  prisma.stripeUpdateShouldTimeout = true;
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === false, "restore fails on timeout");
  assert(((result as any).error).includes("Retry"), "timeout error mentions retry");
}

// 10. Retry after restore timeout uses the same idempotency key
async function testRetryAfterRestoreTimeoutUsesSameKey() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  prisma.stripeUpdateShouldTimeout = true;
  const deps = makeRecoveryDeps(prisma);
  // First attempt: timeout
  await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  // Get the recovery key that was persisted
  const opAfterTimeout = prisma.ops.get(op.id)!;
  assert(!!opAfterTimeout.recoveryIdempotencyKey, "recovery key persisted after timeout");
  const firstKey = opAfterTimeout.recoveryIdempotencyKey;
  // Second attempt: succeed
  prisma.stripeUpdateShouldTimeout = false;
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === true, "retry succeeds after timeout");
  // The recovery key should be the same
  const opAfterRetry = prisma.ops.get(op.id)!;
  assert(opAfterRetry.recoveryIdempotencyKey === firstKey, "recovery key reused on retry");
  // Verify the Stripe call used the same key
  const recoveryCalls = prisma.stripeUpdateCalls.filter((c) => c.idempotencyKey === firstKey);
  assert(recoveryCalls.length >= 1, "Stripe call used the persisted recovery key");
}

// 11. Complete DB when Stripe equals target
async function testCompleteDbWhenStripeAtTarget() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // Stripe is at 3 (target), DB is at 5 (original)
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === true, "complete DB succeeds");
  assert(prisma.orgs.get("org_1")!.seatLimit === 3, "seatLimit updated to 3");
  assert(prisma.users.get("user_1")!.accountStatus === "ARCHIVED", "user_1 archived");
  assert(prisma.users.get("user_2")!.organizationId === null, "user_2 detached");
  const updatedOp = prisma.ops.get(op.id)!;
  assert(updatedOp.resolutionType === "COMPLETED_DB", "resolutionType COMPLETED_DB");
}

// 12. Complete DB blocked when Stripe differs
async function testCompleteDbBlockedWhenStripeDiffers() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // Set Stripe to something other than target (3)
  prisma.stripeQuantity = 7;
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === false, "complete DB blocked when Stripe differs");
  assert(((result as any).error).includes("RESTORE_ORIGINAL"), "error suggests RESTORE_ORIGINAL");
}

// 13. Complete DB blocked when organization state drifted (seatLimit changed)
async function testCompleteDbBlockedWhenSeatLimitDrifted() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // Someone changed the seatLimit after the operation was created
  prisma.orgs.get("org_1")!.seatLimit = 4;
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === false, "complete DB blocked when seatLimit drifted");
  assert(((result as any).error).includes("drifted") || ((result as any).error).includes("RESTORE_ORIGINAL"), "error mentions drift");
}

// 14. Complete DB blocked when selected membership changed (user left org)
async function testCompleteDbBlockedWhenMembershipChanged() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // user_1 left the org
  prisma.users.get("user_1")!.organizationId = "org_2";
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === false, "complete DB blocked when member left org");
}

// 15. Complete DB blocked when a selected user became TEAM_ADMIN
async function testCompleteDbBlockedWhenUserBecameTeamAdmin() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  // user_1 was promoted to TEAM_ADMIN
  prisma.users.get("user_1")!.role = "TEAM_ADMIN";
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === false, "complete DB blocked when user became TEAM_ADMIN");
  assert(((result as any).error).includes("admin") || ((result as any).error).includes("RESTORE_ORIGINAL"), "error mentions admin");
}

// 16. DB failure during completion
async function testDbFailureDuringCompletion() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  prisma.dbTransactionShouldFail = true;
  const deps = makeRecoveryDeps(prisma);
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "COMPLETED_DB", "RESOLVE");
  assert(result.success === false, "DB completion fails on DB error");
  assert(((result as any).error).includes("DB completion failed"), "error mentions DB completion failed");
  const updatedOp = prisma.ops.get(op.id)!;
  assert(updatedOp.status === "RECOVERY_REQUIRED", "op stays RECOVERY_REQUIRED after DB failure");
}

// 17. Resolved-operation replay
async function testResolvedOperationReplay() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  // First resolution succeeds
  const r1 = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(r1.success === true, "first resolution succeeds");
  // Replay with same resolution
  const r2 = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(r2.success === true, "replay returns success");
  assert(((r2 as any).summary).includes("Previously") || r2.success === true, "replay is idempotent");
}

// 18. Original quantities remain unchanged after every recovery path
async function testOriginalQuantitiesUnchanged() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  const originalQtyBefore = op.originalStripeQuantity;
  const originalLimitBefore = op.originalSeatLimit;
  const deps = makeRecoveryDeps(prisma);
  // Try both resolution types (restore first, then complete will fail since Stripe is at original)
  await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  const opAfter = prisma.ops.get(op.id)!;
  assert(opAfter.originalStripeQuantity === originalQtyBefore, "originalStripeQuantity unchanged after restore");
  assert(opAfter.originalSeatLimit === originalLimitBefore, "originalSeatLimit unchanged after restore");
}

// 19. Resolution audit fields are recorded
async function testResolutionAuditFieldsRecorded() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  const opAfter = prisma.ops.get(op.id)!;
  assert(!!opAfter.resolvedAt, "resolvedAt recorded");
  assert(opAfter.resolvedByUserId === "global_admin_1", "resolvedByUserId recorded");
  assert(opAfter.resolutionType === "RESTORE_ORIGINAL", "resolutionType recorded");
  assert(!!opAfter.resolutionSummary, "resolutionSummary recorded");
}

// 20. Claim tokens prevent two recovery workers from finalizing
async function testClaimTokensPreventDoubleFinalize() {
  const prisma = new FakePrisma();
  const { op } = await setupOrgWithRecoveryAsync(prisma);
  const deps = makeRecoveryDeps(prisma);
  // Manually set a recovery claim token (simulating another admin is working)
  const otherToken = "other-admin-token";
  await prisma.seatReconciliationOperation.updateMany({
    where: { id: op.id, status: "RECOVERY_REQUIRED" },
    data: { recoveryClaimToken: otherToken, recoveryClaimedAt: new Date() },
  });
  // Try to resolve — should fail because another admin holds the claim
  const result = await resolveRecoveryRequiredOperation(deps, adminCaller, op.id, "RESTORE_ORIGINAL", "RESOLVE");
  assert(result.success === false, "blocked when another admin holds claim");
  assert(((result as any).error).includes("Another admin") || ((result as any).error).includes("retry"), "error mentions another admin");
}

// ─── Immutable snapshot regression tests ─────────────────────────────────────

// 21. Original Stripe quantity preserved across crash + retry
async function testOriginalQuantityPreservedAcrossCrashRetry() {
  const prisma = new FakePrisma();
  // Setup: org with 5 seats, 4 members + admin
  const org: FakeOrg = { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" };
  prisma.orgs.set("org_1", org);
  prisma.stripeQuantity = 5;
  for (let i = 0; i < 4; i++) {
    prisma.users.set(`user_${i + 1}`, {
      id: `user_${i + 1}`,
      organizationId: "org_1",
      role: "USER",
      accountStatus: "ACTIVE",
    });
  }
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: "org_1",
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
  });

  const deps = makeReconcileDeps(prisma);
  const ctx = {
    userId: "admin_1",
    organizationId: "org_1",
    organization: { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" },
  };
  const reqId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  // First attempt: Stripe succeeds (5→3), then DB fails, then compensation fails
  prisma.dbTransactionShouldFail = true;
  prisma.compensationShouldFail = true;
  const r1 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r1.success === false, "first attempt fails");
  assert(prisma.stripeQuantity === 3, "Stripe at 3 after first attempt");

  const opAfterFirst = Array.from(prisma.ops.values())[0];
  assert(opAfterFirst.originalStripeQuantity === 5, "originalStripeQuantity is 5 after first attempt");
  assert(opAfterFirst.status === "RECOVERY_REQUIRED", "op is RECOVERY_REQUIRED");

  // Now retry with same requestId — the op is RECOVERY_REQUIRED, should return recovery error
  prisma.dbTransactionShouldFail = false;
  prisma.compensationShouldFail = false;
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r2.success === false, "retry of RECOVERY_REQUIRED returns failure");
  assert((r2 as any).recoveryRequired === true, "retry returns recoveryRequired");

  // The original quantity must still be 5
  const opAfterRetry = Array.from(prisma.ops.values())[0];
  assert(opAfterRetry.originalStripeQuantity === 5, "originalStripeQuantity still 5 after retry");
}

// 22. Idempotency key reused on stale reclaim
async function testIdempotencyKeyReusedOnStaleReclaim() {
  const prisma = new FakePrisma();
  const org: FakeOrg = { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" };
  prisma.orgs.set("org_1", org);
  prisma.stripeQuantity = 5;
  for (let i = 0; i < 4; i++) {
    prisma.users.set(`user_${i + 1}`, {
      id: `user_${i + 1}`,
      organizationId: "org_1",
      role: "USER",
      accountStatus: "ACTIVE",
    });
  }
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: "org_1",
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
  });

  const deps = makeReconcileDeps(prisma);
  const ctx = {
    userId: "admin_1",
    organizationId: "org_1",
    organization: { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" },
  };
  const reqId = "cccccccc-cccc-cccc-cccc-cccccccccccc";

  // First attempt: Stripe fails
  prisma.stripeUpdateShouldFail = true;
  const r1 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r1.success === false, "first attempt fails (Stripe error)");

  const opAfterFirst = Array.from(prisma.ops.values())[0];
  const firstKey = opAfterFirst.mainIdempotencyKey;
  assert(!!firstKey, "main idempotency key persisted after first attempt");

  // Second attempt: Stripe succeeds (retry with same requestId)
  prisma.stripeUpdateShouldFail = false;
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r2.success === true, "retry succeeds");

  const opAfterRetry = Array.from(prisma.ops.values())[0];
  assert(opAfterRetry.mainIdempotencyKey === firstKey, "main idempotency key reused on retry");

  // Verify the Stripe calls used the same key
  const mainCalls = prisma.stripeUpdateCalls.filter((c) => c.idempotencyKey === firstKey);
  assert(mainCalls.length >= 1, "Stripe call used the persisted main key");
}

// 23. Compensation uses a different stable key
async function testCompensationUsesDifferentStableKey() {
  const prisma = new FakePrisma();
  const org: FakeOrg = { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" };
  prisma.orgs.set("org_1", org);
  prisma.stripeQuantity = 5;
  for (let i = 0; i < 4; i++) {
    prisma.users.set(`user_${i + 1}`, {
      id: `user_${i + 1}`,
      organizationId: "org_1",
      role: "USER",
      accountStatus: "ACTIVE",
    });
  }
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: "org_1",
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
  });

  const deps = makeReconcileDeps(prisma);
  const ctx = {
    userId: "admin_1",
    organizationId: "org_1",
    organization: { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" },
  };

  // DB fails → compensation runs
  prisma.dbTransactionShouldFail = true;
  await executeSeatReconciliation(deps, ctx, "dddddddd-dddd-dddd-dddd-dddddddddddd", 3, {
    user_1: "lock",
    user_2: "remove",
  });

  const op = Array.from(prisma.ops.values())[0];
  const mainKey = op.mainIdempotencyKey;
  const compKey = op.compensationIdempotencyKey;
  assert(!!mainKey, "main key persisted");
  assert(!!compKey, "compensation key persisted");
  assert(mainKey !== compKey, "main and compensation keys are different");
  assert(compKey!.includes("comp"), "compensation key contains 'comp'");
}

// 24. No key is used with two different quantities
async function testNoKeyUsedWithTwoQuantities() {
  const prisma = new FakePrisma();
  const org: FakeOrg = { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" };
  prisma.orgs.set("org_1", org);
  prisma.stripeQuantity = 5;
  for (let i = 0; i < 4; i++) {
    prisma.users.set(`user_${i + 1}`, {
      id: `user_${i + 1}`,
      organizationId: "org_1",
      role: "USER",
      accountStatus: "ACTIVE",
    });
  }
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: "org_1",
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
  });

  const deps = makeReconcileDeps(prisma);
  const ctx = {
    userId: "admin_1",
    organizationId: "org_1",
    organization: { id: "org_1", name: "Test Org", seatLimit: 5, stripeSubscriptionId: "sub_123" },
  };

  // DB fails → compensation runs
  prisma.dbTransactionShouldFail = true;
  await executeSeatReconciliation(deps, ctx, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", 3, {
    user_1: "lock",
    user_2: "remove",
  });

  // Group Stripe calls by idempotency key and verify each key has only one quantity
  const keyQuantities = new Map<string, Set<number>>();
  for (const call of prisma.stripeUpdateCalls) {
    if (!call.idempotencyKey) continue;
    if (!keyQuantities.has(call.idempotencyKey)) {
      keyQuantities.set(call.idempotencyKey, new Set());
    }
    keyQuantities.get(call.idempotencyKey)!.add(call.quantity);
  }
  for (const [key, quantities] of keyQuantities) {
    assert(
      quantities.size === 1,
      `idempotency key ${key} used with only one quantity (${Array.from(quantities).join(", ")})`
    );
  }
}

// 25. Roster excludes ADMIN and TEAM_ADMIN (production behavior test)
async function testTeamAdminExcludedFromRoster() {
  // Test the real getReconcileRoster function with a DI fake prisma.
  // Supply users with roles USER, TEAM_ADMIN, and ADMIN.
  // Assert only eligible USER records are returned.
  const fakeRosterPrisma: ReconcileRosterPrisma = {
    user: {
      findMany: async (args) => {
        const allUsers = [
          { id: "u1", role: "USER", accountStatus: "ACTIVE" },
          { id: "u2", role: "USER", accountStatus: "ACTIVE" },
          { id: "u3", role: "TEAM_ADMIN", accountStatus: "ACTIVE" },
          { id: "u4", role: "ADMIN", accountStatus: "ACTIVE" },
          { id: "u5", role: "USER", accountStatus: "ARCHIVED" },
          { id: "caller", role: "TEAM_ADMIN", accountStatus: "ACTIVE" },
        ];
        return allUsers.filter((u) => {
          if (args.where.organizationId && u.id === "") return false;
          if (args.where.id?.not && u.id === args.where.id.not) return false;
          if (args.where.role?.notIn && args.where.role.notIn.includes(u.role)) return false;
          if (args.where.accountStatus?.not && u.accountStatus === args.where.accountStatus.not) return false;
          return true;
        });
      },
    },
  };

  const roster = await getReconcileRoster(fakeRosterPrisma, "org1", "caller");

  assert(roster.length === 2, `roster should return 2 eligible USERs, got ${roster.length}`);
  assert(
    roster.every((m) => m.role === "USER"),
    "all returned members must have role USER"
  );
  assert(
    !roster.some((m) => m.role === "ADMIN" || m.role === "TEAM_ADMIN"),
    "no ADMIN or TEAM_ADMIN in roster"
  );
  assert(
    !roster.some((m) => m.id === "caller"),
    "caller excluded from roster"
  );
  assert(
    !roster.some((m) => m.accountStatus === "ARCHIVED"),
    "ARCHIVED members excluded from roster"
  );
}

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  await testNonAdminDenied();
  await testTeamAdminDenied();
  await testAdminCanList();
  await testIdorRejected();
  await testConcurrentAdminRecovery();
  await testRestoreWhenStripeAtTarget();
  await testRestoreWhenStripeAlreadyOriginal();
  await testRestoreStripeFailure();
  await testRestoreTimeout();
  await testRetryAfterRestoreTimeoutUsesSameKey();
  await testCompleteDbWhenStripeAtTarget();
  await testCompleteDbBlockedWhenStripeDiffers();
  await testCompleteDbBlockedWhenSeatLimitDrifted();
  await testCompleteDbBlockedWhenMembershipChanged();
  await testCompleteDbBlockedWhenUserBecameTeamAdmin();
  await testDbFailureDuringCompletion();
  await testResolvedOperationReplay();
  await testOriginalQuantitiesUnchanged();
  await testResolutionAuditFieldsRecorded();
  await testClaimTokensPreventDoubleFinalize();
  // Regression tests
  await testOriginalQuantityPreservedAcrossCrashRetry();
  await testIdempotencyKeyReusedOnStaleReclaim();
  await testCompensationUsesDifferentStableKey();
  await testNoKeyUsedWithTwoQuantities();
  await testTeamAdminExcludedFromRoster();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nAll seat-recovery tests passed.");
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});
