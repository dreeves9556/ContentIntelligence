/* eslint-disable @typescript-eslint/no-explicit-any */
// Tests for the durable seat-reconciliation orchestrator.
// Run: npx tsx src/lib/__tests__/seat-reconciliation.test.ts
//
// Exercises the real `executeSeatReconciliation` from
// src/lib/seat-reconciliation-service.ts with injected Prisma/Stripe fakes.
// No algorithm is copied — the test drives the production service.

import {
  executeSeatReconciliation,
  validateSeatReduction,
  decideClaim,
  type SeatReconciliationDeps,
  type SeatReconciliationPrisma,
  type SeatReconciliationOpRow,
  type SeatStripeClient,
  type SeatValidationUser,
  SeatReconciliationStatus,
} from "../seat-reconciliation-service";
import type { Prisma } from "@prisma/client";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  } else {
    // console.log(`PASS: ${label}`);
  }
}

// ─── In-memory fake Prisma ────────────────────────────────────────────────

interface FakeUser extends SeatValidationUser {
  isComped?: boolean;
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

  async $transaction<T>(
    fn: (tx: SeatReconciliationTx) => Promise<T>,
    opts?: { isolationLevel?: "Serializable" }
  ): Promise<T> {
    const tx: SeatReconciliationTx = {
      user: {
        findMany: async (args: any) => {
          return Array.from(this.users.values()).filter((u) =>
            args.where.id.in.includes(u.id)
          );
        },
        count: async (args: any) => {
          return Array.from(this.users.values()).filter(
            (u) =>
              u.organizationId === args.where.organizationId &&
              u.accountStatus !== args.where.accountStatus.not
          ).length;
        },
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
    updateMany: async (args: any) => {
      const row = this.ops.get(args.where.id);
      if (!row) return { count: 0 };
      if (args.where.claimToken !== undefined && row.claimToken !== args.where.claimToken) {
        return { count: 0 };
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
      if (data.attempts !== undefined && typeof data.attempts === "object") {
        row.attempts += (data.attempts as { increment: number }).increment;
      }
      return { count: 1 };
    },
  };

  user = {
    findMany: async (args: any) => {
      return Array.from(this.users.values()).filter((u) =>
        args.where.id.in.includes(u.id)
      );
    },
    count: async (args: any) => {
      return Array.from(this.users.values()).filter(
        (u) =>
          u.organizationId === args.where.organizationId &&
          u.accountStatus !== args.where.accountStatus.not
      ).length;
    },
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

interface SeatReconciliationTx {
  user: SeatReconciliationPrisma["user"];
  organization: SeatReconciliationPrisma["organization"];
  inviteToken: SeatReconciliationPrisma["inviteToken"];
}

// ─── Fake Stripe ──────────────────────────────────────────────────────────

class FakeStripe implements SeatStripeClient {
  prisma: FakePrisma;
  constructor(prisma: FakePrisma) {
    this.prisma = prisma;
  }
  subscriptions = {
    retrieve: async (id: string) => ({
      items: {
        data: [{ id: "item_1", quantity: this.prisma.stripeQuantity }],
      },
    }),
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
      if (this.prisma.stripeUpdateShouldFail) {
        throw new Error("SIMULATED_STRIPE_FAILURE");
      }
      if (this.prisma.stripeUpdateShouldTimeout) {
        throw new Error("SIMULATED_STRIPE_TIMEOUT");
      }
      // For compensation, check if we should fail
      if (options?.idempotencyKey.startsWith("seat_reconcile_comp_") && this.prisma.compensationShouldFail) {
        throw new Error("SIMULATED_COMPENSATION_FAILURE");
      }
      this.prisma.stripeQuantity = params.items[0].quantity;
      return {};
    },
  };
}

// ─── Test harness ─────────────────────────────────────────────────────────

function makeDeps(prisma: FakePrisma): SeatReconciliationDeps {
  return {
    prisma,
    stripe: new FakeStripe(prisma),
    now: () => new Date("2026-08-08T12:00:00Z"),
    randomUUID: () => `uuid-${Math.random().toString(36).slice(2, 10)}`,
  };
}

function setupOrg(
  prisma: FakePrisma,
  orgId: string = "org_1",
  seatLimit: number = 5,
  memberCount: number = 4
): { org: FakeOrg; members: FakeUser[] } {
  const org: FakeOrg = {
    id: orgId,
    name: "Test Org",
    seatLimit,
    stripeSubscriptionId: "sub_123",
  };
  prisma.orgs.set(orgId, org);
  prisma.stripeQuantity = seatLimit;

  const members: FakeUser[] = [];
  for (let i = 0; i < memberCount; i++) {
    const u: FakeUser = {
      id: `user_${i + 1}`,
      organizationId: orgId,
      role: "USER",
      accountStatus: "ACTIVE",
    };
    prisma.users.set(u.id, u);
    members.push(u);
  }
  // Add the admin (counts as an active member for seat purposes)
  prisma.users.set("admin_1", {
    id: "admin_1",
    organizationId: orgId,
    role: "TEAM_ADMIN",
    accountStatus: "ACTIVE",
  });

  return { org, members };
}

function makeCtx(orgId: string = "org_1", seatLimit: number = 5) {
  return {
    userId: "admin_1",
    organizationId: orgId,
    organization: {
      id: orgId,
      name: "Test Org",
      seatLimit,
      stripeSubscriptionId: "sub_123",
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

async function testSuccessfulReduction() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const memberActions: Record<string, "lock" | "remove"> = {
    user_1: "lock",
    user_2: "remove",
  };

  const result: any = await executeSeatReconciliation(deps, ctx, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 3, memberActions);

  assert(result.success === true, "successful reduction returns success");
  assert(result.newQuantity === 3, "newQuantity is 3");
  assert(prisma.stripeQuantity === 3, "Stripe quantity reduced to 3");
  assert(prisma.orgs.get("org_1")!.seatLimit === 3, "seatLimit updated to 3");
  assert(prisma.users.get("user_1")!.accountStatus === "ARCHIVED", "user_1 archived (lock)");
  assert(prisma.users.get("user_1")!.organizationId === "org_1", "user_1 still in org (lock)");
  assert(prisma.users.get("user_2")!.accountStatus === "ARCHIVED", "user_2 archived (remove)");
  assert(prisma.users.get("user_2")!.organizationId === null, "user_2 detached (remove)");

  const op = Array.from(prisma.ops.values())[0];
  assert(op.status === "COMPLETED", "op status COMPLETED");
  assert(op.originalStripeQuantity === 5, "originalStripeQuantity recorded");
}

async function testUnauthorizedCaller() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  // Add a second org
  prisma.orgs.set("org_2", { id: "org_2", name: "Other Org", seatLimit: 5, stripeSubscriptionId: "sub_456" });
  const deps = makeDeps(prisma);
  // Caller claims to be in org_2 but selects members from org_1
  const ctx = {
    userId: "admin_1",
    organizationId: "org_2",
    organization: { id: "org_2", name: "Other Org", seatLimit: 5, stripeSubscriptionId: "sub_456" },
  };
  const result: any = await executeSeatReconciliation(deps, ctx, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", 3, { user_1: "lock", user_2: "remove" });
  // The orchestrator validates org membership of selected users; org_2 caller
  // selecting org_1 members fails the cross-org check.
  assert(result.success === false, "cross-org caller blocked");
  assert(result.error!.includes("own organization"), "cross-org error message");
}

async function testCrossOrgMember() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  // Add a user in a different org
  prisma.users.set("user_x", {
    id: "user_x",
    organizationId: "org_2",
    role: "USER",
    accountStatus: "ACTIVE",
  });
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "cccccccc-cccc-cccc-cccc-cccccccccccc", 3, { user_1: "lock", user_x: "remove" });
  assert(result.success === false, "cross-org member rejected");
  assert(result.error!.includes("own organization"), "cross-org error message");
  // Members untouched
  assert(prisma.users.get("user_1")!.accountStatus === "ACTIVE", "user_1 not archived on validation failure");
  assert(prisma.users.get("user_x")!.accountStatus === "ACTIVE", "user_x not archived on validation failure");
}

async function testDuplicateMemberId() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  // A Record can't hold duplicate keys, but we simulate by passing a member
  // that doesn't exist (fewer fetched rows than keys).
  const result: any = await executeSeatReconciliation(deps, ctx, "dddddddd-dddd-dddd-dddd-dddddddddddd", 3, { user_1: "lock", nonexistent: "remove" });
  assert(result.success === false, "nonexistent member rejected");
}

async function testTooFewSelections() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", 3, { user_1: "lock" });
  assert(result.success === false, "too few selections rejected");
}

async function testTooManySelections() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "ffffffff-ffff-ffff-ffff-ffffffffffff", 3, { user_1: "lock", user_2: "lock", user_3: "remove" });
  assert(result.success === false, "too many selections rejected");
}

async function testCallerSelected() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "11111111-1111-1111-1111-111111111111", 3, { admin_1: "lock", user_2: "remove" });
  assert(result.success === false, "caller self-selection rejected");
}

async function testGlobalAdminSelected() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.users.set("global_admin", {
    id: "global_admin",
    organizationId: "org_1",
    role: "ADMIN",
    accountStatus: "ACTIVE",
  });
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "22222222-2222-2222-2222-222222222222", 3, { global_admin: "lock", user_2: "remove" });
  assert(result.success === false, "global admin selection rejected");
}

async function testStripeFailureBeforeDb() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.stripeUpdateShouldFail = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "33333333-3333-3333-3333-333333333333", 3, { user_1: "lock", user_2: "remove" });

  assert(result.success === false, "Stripe failure returns failure");
  assert(result.error!.includes("No members were changed"), "Stripe failure error mentions no members changed");
  // Critical invariant: members untouched
  assert(prisma.users.get("user_1")!.accountStatus === "ACTIVE", "user_1 not archived on Stripe failure");
  assert(prisma.users.get("user_2")!.accountStatus === "ACTIVE", "user_2 not archived on Stripe failure");
  assert(prisma.users.get("user_2")!.organizationId === "org_1", "user_2 not detached on Stripe failure");
  // seatLimit unchanged
  assert(prisma.orgs.get("org_1")!.seatLimit === 5, "seatLimit unchanged on Stripe failure");
  assert(prisma.stripeQuantity === 5, "Stripe quantity unchanged on Stripe failure");
  // Op is FAILED (retryable)
  const op = Array.from(prisma.ops.values())[0];
  assert(op.status === "FAILED", "op FAILED on Stripe failure");
}

async function testStripeTimeout() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.stripeUpdateShouldTimeout = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "44444444-4444-4444-4444-444444444444", 3, { user_1: "lock", user_2: "remove" });

  assert(result.success === false, "Stripe timeout returns failure");
  assert(prisma.users.get("user_1")!.accountStatus === "ACTIVE", "members untouched on timeout");
  assert(prisma.orgs.get("org_1")!.seatLimit === 5, "seatLimit unchanged on timeout");
}

async function testDbFailureAfterStripeSuccess() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.dbTransactionShouldFail = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "55555555-5555-5555-5555-555555555555", 3, { user_1: "lock", user_2: "remove" });

  assert(result.success === false, "DB failure returns failure");
  assert(result.error!.includes("restored"), "DB failure error mentions Stripe restored");
  // Members untouched (DB txn failed)
  assert(prisma.users.get("user_1")!.accountStatus === "ACTIVE", "user_1 not archived on DB failure");
  assert(prisma.users.get("user_2")!.accountStatus === "ACTIVE", "user_2 not archived on DB failure");
  // Stripe compensated back to original
  assert(prisma.stripeQuantity === 5, "Stripe quantity restored to original after compensation");
  // seatLimit unchanged
  assert(prisma.orgs.get("org_1")!.seatLimit === 5, "seatLimit unchanged after DB failure + compensation");
  // Op is FAILED (retryable)
  const op = Array.from(prisma.ops.values())[0];
  assert(op.status === "FAILED", "op FAILED after DB failure + compensation");
}

async function testSuccessfulCompensation() {
  // Same as testDbFailureAfterStripeSuccess but explicitly verify compensation
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.dbTransactionShouldFail = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  await executeSeatReconciliation(deps, ctx, "66666666-6666-6666-6666-666666666666", 3, { user_1: "lock", user_2: "remove" });

  // Verify two Stripe calls: main (to 3) + comp (back to 5)
  const mainCall = prisma.stripeUpdateCalls.find((c) => c.idempotencyKey?.startsWith("seat_reconcile_main_"));
  const compCall = prisma.stripeUpdateCalls.find((c) => c.idempotencyKey?.startsWith("seat_reconcile_comp_"));
  assert(!!mainCall, "main Stripe call made");
  assert(!!compCall, "compensation Stripe call made");
  assert(mainCall!.quantity === 3, "main call set quantity to 3");
  assert(compCall!.quantity === 5, "compensation call restored quantity to 5");
}

async function testFailedCompensationRecovery() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.dbTransactionShouldFail = true;
  prisma.compensationShouldFail = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const result: any = await executeSeatReconciliation(deps, ctx, "77777777-7777-7777-7777-777777777777", 3, { user_1: "lock", user_2: "remove" });

  assert(result.success === false, "compensation failure returns failure");
  assert((result as { recoveryRequired?: boolean }).recoveryRequired === true, "recoveryRequired flag set");
  assert(result.error!.includes("recovery"), "error mentions recovery");
  // Stripe quantity is still at target (reduction succeeded, comp failed)
  assert(prisma.stripeQuantity === 3, "Stripe quantity stays at target after comp failure");
  // Op is RECOVERY_REQUIRED
  const op = Array.from(prisma.ops.values())[0];
  assert(op.status === "RECOVERY_REQUIRED", "op RECOVERY_REQUIRED");
  assert(!!op.lastError, "op has lastError for admin diagnosis");
  assert(op.lastError!.includes("Original Stripe quantity"), "lastError preserves original quantity");
}

async function testRetryAfterStripeFailure() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const reqId = "88888888-8888-8888-8888-888888888888";

  // First attempt: Stripe fails
  prisma.stripeUpdateShouldFail = true;
  const r1 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r1.success === false, "first attempt fails");

  // Second attempt: Stripe succeeds (retry with same requestId)
  prisma.stripeUpdateShouldFail = false;
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r2.success === true, "retry succeeds");
  assert(prisma.stripeQuantity === 3, "Stripe quantity reduced after retry");
  assert(prisma.orgs.get("org_1")!.seatLimit === 3, "seatLimit updated after retry");
}

async function testRetryAfterDbFailure() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const reqId = "99999999-9999-9999-9999-999999999999";

  // First attempt: DB fails (Stripe succeeds, then compensates)
  prisma.dbTransactionShouldFail = true;
  const r1 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r1.success === false, "first attempt fails (DB failure)");
  assert(prisma.stripeQuantity === 5, "Stripe compensated back to 5");

  // Second attempt: DB succeeds
  prisma.dbTransactionShouldFail = false;
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r2.success === true, "retry succeeds after DB failure");
  assert(prisma.stripeQuantity === 3, "Stripe quantity reduced after retry");
}

async function testDuplicateConcurrentRequestId() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const reqId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

  // First attempt succeeds
  const r1 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r1.success === true, "first attempt succeeds");

  // Second attempt with same requestId → returns existing COMPLETED result
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });
  assert(r2.success === true, "duplicate requestId returns success");
  assert((r2 as { resumed?: boolean }).resumed === true, "duplicate requestId marked as resumed");
}

async function testCompletedRequestReplay() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);
  const reqId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  await executeSeatReconciliation(deps, ctx, reqId, 3, { user_1: "lock", user_2: "remove" });

  // Replay with different member actions but same requestId → still returns COMPLETED
  const r2 = await executeSeatReconciliation(deps, ctx, reqId, 3, { user_3: "lock", user_4: "remove" });
  assert(r2.success === true, "completed replay returns success");
  assert((r2 as { resumed?: boolean }).resumed === true, "completed replay marked resumed");
  // Original members stay archived, new ones untouched
  assert(prisma.users.get("user_1")!.accountStatus === "ARCHIVED", "original user_1 still archived");
  assert(prisma.users.get("user_3")!.accountStatus === "ACTIVE", "user_3 not touched by replay");
}

async function testMemberStatePreservedAfterFailure() {
  const prisma = new FakePrisma();
  setupOrg(prisma, "org_1", 5, 4);
  prisma.stripeUpdateShouldFail = true;
  const deps = makeDeps(prisma);
  const ctx = makeCtx("org_1", 5);

  const originalStates = new Map<string, { accountStatus: string; organizationId: string | null }>();
  for (const [id, u] of prisma.users) {
    originalStates.set(id, { accountStatus: u.accountStatus, organizationId: u.organizationId });
  }

  await executeSeatReconciliation(deps, ctx, "cccccccc-cccc-cccc-cccc-cccccccccccc", 3, { user_1: "lock", user_2: "remove" });

  for (const [id, original] of originalStates) {
    const u = prisma.users.get(id)!;
    assert(
      u.accountStatus === original.accountStatus && u.organizationId === original.organizationId,
      `user ${id} state preserved after failure`
    );
  }
}

async function testPureValidation() {
  // Test validateSeatReduction directly
  const users: SeatValidationUser[] = [
    { id: "u1", organizationId: "org_1", role: "USER", accountStatus: "ACTIVE" },
    { id: "u2", organizationId: "org_1", role: "USER", accountStatus: "ACTIVE" },
  ];

  // Valid
  assert(
    validateSeatReduction({
      targetSeats: 3,
      orgSeatLimit: 5,
      orgStripeSubscriptionId: "sub_1",
      expectedOrgId: "org_1",
      actorUserId: "admin",
      memberActions: { u1: "lock", u2: "remove" },
      selectedUsers: users,
      activeMembers: 5,
      pendingInvites: 0,
    }) === null,
    "valid reduction passes validation"
  );

  // Target >= seatLimit
  assert(
    validateSeatReduction({
      targetSeats: 5,
      orgSeatLimit: 5,
      orgStripeSubscriptionId: "sub_1",
      expectedOrgId: "org_1",
      actorUserId: "admin",
      memberActions: { u1: "lock" },
      selectedUsers: [users[0]],
      activeMembers: 5,
      pendingInvites: 0,
    }) !== null,
    "target >= seatLimit rejected"
  );

  // No subscription
  assert(
    validateSeatReduction({
      targetSeats: 3,
      orgSeatLimit: 5,
      orgStripeSubscriptionId: null,
      expectedOrgId: "org_1",
      actorUserId: "admin",
      memberActions: { u1: "lock", u2: "remove" },
      selectedUsers: users,
      activeMembers: 5,
      pendingInvites: 0,
    }) !== null,
    "no subscription rejected"
  );

  // Cross-org
  assert(
    validateSeatReduction({
      targetSeats: 3,
      orgSeatLimit: 5,
      orgStripeSubscriptionId: "sub_1",
      expectedOrgId: "org_1",
      actorUserId: "admin",
      memberActions: { u1: "lock", u2: "remove" },
      selectedUsers: [
        { id: "u1", organizationId: "org_2", role: "USER", accountStatus: "ACTIVE" },
        users[1],
      ],
      activeMembers: 5,
      pendingInvites: 0,
    }) !== null,
    "cross-org member rejected"
  );

  // Admin selected
  assert(
    validateSeatReduction({
      targetSeats: 3,
      orgSeatLimit: 5,
      orgStripeSubscriptionId: "sub_1",
      expectedOrgId: "org_1",
      actorUserId: "admin",
      memberActions: { admin: "lock", u2: "remove" },
      selectedUsers: [
        { id: "admin", organizationId: "org_1", role: "USER", accountStatus: "ACTIVE" },
        users[1],
      ],
      activeMembers: 5,
      pendingInvites: 0,
    }) !== null,
    "caller self-selection rejected"
  );
}

// ─── Run ──────────────────────────────────────────────────────────────────

async function main() {
  await testSuccessfulReduction();
  await testUnauthorizedCaller();
  await testCrossOrgMember();
  await testDuplicateMemberId();
  await testTooFewSelections();
  await testTooManySelections();
  await testCallerSelected();
  await testGlobalAdminSelected();
  await testStripeFailureBeforeDb();
  await testStripeTimeout();
  await testDbFailureAfterStripeSuccess();
  await testSuccessfulCompensation();
  await testFailedCompensationRecovery();
  await testRetryAfterStripeFailure();
  await testRetryAfterDbFailure();
  await testDuplicateConcurrentRequestId();
  await testCompletedRequestReplay();
  await testMemberStatePreservedAfterFailure();
  testPureValidation();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("\nAll seat-reconciliation tests passed.");
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});
