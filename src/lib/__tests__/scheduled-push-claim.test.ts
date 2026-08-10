// Tests for the scheduled-push bounded recoverable claim protocol.
// Run: npx tsx src/lib/__tests__/scheduled-push-claim.test.ts
//
// Exercises the real `claimScheduledPushes` and `processClaimedScheduledPushes`
// from src/lib/scheduled-push-service.ts with an in-memory fake Prisma and
// fake broadcast sender. No algorithm is copied — the test drives the
// production service functions via dependency injection.
//
// Concurrency guarantees (true conditional updateMany races) require a real
// PostgreSQL integration test. The unit tests here exercise the state
// transitions and lease/recovery logic with a single-threaded fake.

export {};

import {
  claimScheduledPushes,
  processClaimedScheduledPushes,
  SCHEDULED_PUSH_LEASE_MS,
  type ScheduledPushDeps,
  type ScheduledPushPrisma,
  type ScheduledPushRow,
  type ScheduledPushStatus,
  type BroadcastResult,
} from "../scheduled-push-service";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

// ─── In-memory fake Prisma ────────────────────────────────────────────────

interface FakeRow extends ScheduledPushRow {
  scheduledFor: Date;
}

class FakePrisma implements ScheduledPushPrisma {
  rows: Map<string, FakeRow> = new Map();
  broadcastShouldFail: boolean = false;
  broadcastResults: Map<string, BroadcastResult> = new Map();
  broadcastCalls: { id: string; segment: string; title: string; body: string; url?: string }[] = [];

  scheduledPushNotification = {
    updateMany: async (args: {
      where: {
        status?: ScheduledPushStatus;
        claimedAt?: { lt: Date };
        id?: string | { in: string[] };
        claimToken?: string;
      };
      data: {
        status?: ScheduledPushStatus;
        claimToken?: string | null;
        claimedAt?: Date | null;
        lastError?: string | null;
        attempts?: { increment: number };
        sentCount?: number;
        failedCount?: number;
      };
    }): Promise<{ count: number }> => {
      let count = 0;
      const ids = this.matchingIds(args.where);
      for (const id of ids) {
        const r = this.rows.get(id);
        if (!r) continue;
        const d = args.data;
        if (d.status !== undefined) r.status = d.status;
        if (d.claimToken !== undefined) r.claimToken = d.claimToken;
        if (d.claimedAt !== undefined) r.claimedAt = d.claimedAt;
        if (d.lastError !== undefined) r.lastError = d.lastError;
        if (d.attempts !== undefined && typeof d.attempts === "object") {
          r.attempts += d.attempts.increment;
        }
        if (d.sentCount !== undefined) r.sentCount = d.sentCount;
        if (d.failedCount !== undefined) r.failedCount = d.failedCount;
        count++;
      }
      return { count };
    },
    findMany: async (args: {
      where: {
        status?: ScheduledPushStatus;
        scheduledFor?: { lte: Date };
        claimToken?: string;
        id?: string | { in: string[] };
      };
      orderBy?: { scheduledFor: "asc" | "desc" };
      take?: number;
      select?: { id: true };
    }): Promise<FakeRow[] | { id: string }[]> => {
      let matched = Array.from(this.rows.values()).filter((r) => {
        if (args.where.status !== undefined && r.status !== args.where.status) return false;
        if (args.where.scheduledFor?.lte && r.scheduledFor > args.where.scheduledFor.lte) return false;
        if (args.where.claimToken !== undefined && r.claimToken !== args.where.claimToken) return false;
        if (args.where.id) {
          if (typeof args.where.id === "string") {
            if (r.id !== args.where.id) return false;
          } else {
            if (!args.where.id.in.includes(r.id)) return false;
          }
        }
        return true;
      });
      if (args.orderBy?.scheduledFor) {
        matched.sort((a, b) => {
          const cmp = a.scheduledFor.getTime() - b.scheduledFor.getTime();
          return args.orderBy!.scheduledFor === "asc" ? cmp : -cmp;
        });
      }
      if (args.take !== undefined) matched = matched.slice(0, args.take);
      if (args.select?.id) {
        return matched.map((r) => ({ id: r.id }));
      }
      return matched;
    },
  };

  private matchingIds(where: {
    status?: ScheduledPushStatus;
    claimedAt?: { lt: Date };
    id?: string | { in: string[] };
    claimToken?: string;
  }): string[] {
    const ids: string[] = [];
    for (const [id, r] of this.rows) {
      if (where.status !== undefined && r.status !== where.status) continue;
      if (where.claimedAt?.lt && (!r.claimedAt || r.claimedAt >= where.claimedAt.lt)) continue;
      if (where.id) {
        if (typeof where.id === "string") {
          if (r.id !== where.id) continue;
        } else {
          if (!where.id.in.includes(r.id)) continue;
        }
      }
      if (where.claimToken !== undefined && r.claimToken !== where.claimToken) continue;
      ids.push(id);
    }
    return ids;
  }
}

function makeRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "push_1",
    title: "Test Push",
    body: "Hello world",
    url: null,
    segment: "all",
    status: "PENDING",
    claimToken: null,
    claimedAt: null,
    scheduledFor: new Date("2026-08-08T10:00:00Z"),
    attempts: 0,
    lastError: null,
    sentCount: 0,
    failedCount: 0,
    ...overrides,
  };
}

function makeDeps(prisma: FakePrisma, now: Date): ScheduledPushDeps {
  return {
    prisma,
    sendBroadcast: async (segment, title, body, url) => {
      prisma.broadcastCalls.push({ id: "call", segment, title, body, url });
      if (prisma.broadcastShouldFail) {
        throw new Error("SIMULATED_BROADCAST_FAILURE");
      }
      return prisma.broadcastResults.get("push_1") ?? { sent: 100, failed: 0 };
    },
    now: () => now,
    randomUUID: () => "tok-test-" + Math.random().toString(36).slice(2, 8),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

async function testClaimDuePending() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({ id: "push_1", status: "PENDING", scheduledFor: new Date("2026-08-08T10:00:00Z") }));
  prisma.rows.set("push_2", makeRow({ id: "push_2", status: "PENDING", scheduledFor: new Date("2026-08-08T11:00:00Z") }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds, reclaimed } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 2, "claims 2 due PENDING rows");
  assert(reclaimed === 0, "no stale rows to reclaim");
  assert(prisma.rows.get("push_1")!.status === "PROCESSING", "push_1 now PROCESSING");
  assert(prisma.rows.get("push_2")!.status === "PROCESSING", "push_2 now PROCESSING");
  assert(prisma.rows.get("push_1")!.claimToken !== null, "push_1 has claimToken");
  assert(prisma.rows.get("push_1")!.attempts === 1, "push_1 attempts incremented");
}

async function testClaimRespectsBatchSize() {
  const prisma = new FakePrisma();
  for (let i = 0; i < 5; i++) {
    prisma.rows.set(`push_${i}`, makeRow({ id: `push_${i}`, status: "PENDING", scheduledFor: new Date(`2026-08-08T1${i}:00:00Z`) }));
  }
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds } = await claimScheduledPushes(deps, 3, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 3, "claims at most batchSize (3)");
}

async function testClaimSkipsFutureScheduled() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({ id: "push_1", status: "PENDING", scheduledFor: new Date("2026-08-08T10:00:00Z") }));
  prisma.rows.set("push_2", makeRow({ id: "push_2", status: "PENDING", scheduledFor: new Date("2026-08-09T10:00:00Z") }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 1, "skips future-scheduled rows");
  assert(claimedIds.includes("push_1"), "claims only the due row");
}

async function testClaimSkipsNonPending() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({ id: "push_1", status: "SENT" }));
  prisma.rows.set("push_2", makeRow({ id: "push_2", status: "PROCESSING", claimToken: "other_tok" }));
  prisma.rows.set("push_3", makeRow({ id: "push_3", status: "CANCELLED" }));
  prisma.rows.set("push_4", makeRow({ id: "push_4", status: "FAILED" }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 0, "claims no non-PENDING rows");
}

async function testReclaimStaleProcessing() {
  const prisma = new FakePrisma();
  const staleTime = new Date("2026-08-08T11:50:00Z"); // 10+ min ago
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PROCESSING",
    claimToken: "old_tok",
    claimedAt: staleTime,
    scheduledFor: new Date("2026-08-08T10:00:00Z"),
  }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:01:00Z"));

  const { claimedIds, reclaimed } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(reclaimed === 1, "reclaimed 1 stale PROCESSING row");
  // After reclaim, the row is PENDING and gets claimed in the same pass
  assert(claimedIds.length === 1, "stale row re-claimed in same pass");
  assert(prisma.rows.get("push_1")!.status === "PROCESSING", "push_1 back to PROCESSING");
  assert(prisma.rows.get("push_1")!.claimToken !== "old_tok", "push_1 has new claimToken");
}

async function testNoReclaimFreshProcessing() {
  const prisma = new FakePrisma();
  const freshTime = new Date("2026-08-08T11:55:00Z"); // 5 min ago, fresh
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PROCESSING",
    claimToken: "live_tok",
    claimedAt: freshTime,
  }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds, reclaimed } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(reclaimed === 0, "no fresh PROCESSING rows reclaimed");
  assert(claimedIds.length === 0, "no rows claimed");
  assert(prisma.rows.get("push_1")!.claimToken === "live_tok", "live worker's token preserved");
}

async function testPreservesTerminalStates() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({ id: "push_1", status: "SENT" }));
  prisma.rows.set("push_2", makeRow({ id: "push_2", status: "CANCELLED" }));
  prisma.rows.set("push_3", makeRow({ id: "push_3", status: "FAILED" }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const { claimedIds, reclaimed } = await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 0, "no terminal rows claimed");
  assert(reclaimed === 0, "no terminal rows reclaimed");
  assert(prisma.rows.get("push_1")!.status === "SENT", "SENT preserved");
  assert(prisma.rows.get("push_2")!.status === "CANCELLED", "CANCELLED preserved");
  assert(prisma.rows.get("push_3")!.status === "FAILED", "FAILED preserved");
}

async function testProcessClaimedSends() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PROCESSING",
    claimToken: "tok_1",
    claimedAt: new Date("2026-08-08T11:55:00Z"),
  }));
  prisma.broadcastResults.set("push_1", { sent: 50, failed: 2 });
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const result = await processClaimedScheduledPushes(deps, ["push_1"]);
  assert(result.processed === 1, "processed 1 row");
  assert(result.sent === 50, "sent count 50");
  assert(result.failed === 2, "failed count 2");
  assert(prisma.rows.get("push_1")!.status === "SENT", "push_1 finalized to SENT");
  assert(prisma.rows.get("push_1")!.sentCount === 50, "sentCount recorded");
  assert(prisma.rows.get("push_1")!.failedCount === 2, "failedCount recorded");
  assert(prisma.rows.get("push_1")!.claimToken === null, "claimToken cleared after SENT");
}

async function testProcessSkipsLostClaim() {
  const prisma = new FakePrisma();
  // Row was stale-reclaimed by another worker — status reset to PENDING, then
  // re-claimed by another worker (PROCESSING with their token). The current
  // worker's claimedIds includes this ID, but the row is no longer in the
  // state the current worker left it. The guard `status !== "PROCESSING"`
  // catches the PENDING case; the PROCESSING-with-different-token case is
  // detected at finalization (at-least-once delivery — documented).
  //
  // This test exercises the PENDING-reclaimed case (guard catches it before
  // broadcast). The PROCESSING-with-different-token case requires a real DB
  // to exercise the conditional updateMany race.
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PENDING", // stale-reclaimed to PENDING, not yet re-claimed
    claimToken: null,
  }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const result = await processClaimedScheduledPushes(deps, ["push_1"]);
  assert(result.processed === 1, "row was iterated");
  assert(result.sent === 0, "no send (claim lost to reclaim)");
  assert(prisma.broadcastCalls.length === 0, "broadcast not called (guard caught non-PROCESSING)");
}

async function testProcessSkipsNonProcessing() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({ id: "push_1", status: "PENDING" }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const result = await processClaimedScheduledPushes(deps, ["push_1"]);
  assert(result.processed === 1, "row was iterated");
  assert(result.sent === 0, "no send (not PROCESSING)");
  assert(prisma.broadcastCalls.length === 0, "broadcast not called for non-PROCESSING");
}

async function testProcessBroadcastFailureMarksFailed() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PROCESSING",
    claimToken: "tok_1",
  }));
  prisma.broadcastShouldFail = true;
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const result = await processClaimedScheduledPushes(deps, ["push_1"]);
  assert(result.processed === 1, "row was iterated");
  assert(result.sent === 0, "no sends succeeded");
  assert(prisma.rows.get("push_1")!.status === "FAILED", "push_1 marked FAILED");
  assert(prisma.rows.get("push_1")!.lastError !== null, "lastError recorded");
  assert(prisma.rows.get("push_1")!.lastError!.includes("SIMULATED_BROADCAST_FAILURE"), "lastError has failure message");
  assert(prisma.rows.get("push_1")!.claimToken === null, "claimToken cleared on FAILED");
}

async function testProcessEmptyClaimedIds() {
  const prisma = new FakePrisma();
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  const result = await processClaimedScheduledPushes(deps, []);
  assert(result.processed === 0, "empty claimedIds → processed 0");
  assert(result.sent === 0, "empty claimedIds → sent 0");
}

async function testClaimOrderingByScheduledFor() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_late", makeRow({ id: "push_late", status: "PENDING", scheduledFor: new Date("2026-08-08T14:00:00Z") }));
  prisma.rows.set("push_early", makeRow({ id: "push_early", status: "PENDING", scheduledFor: new Date("2026-08-08T09:00:00Z") }));
  prisma.rows.set("push_mid", makeRow({ id: "push_mid", status: "PENDING", scheduledFor: new Date("2026-08-08T11:00:00Z") }));
  const deps = makeDeps(prisma, new Date("2026-08-08T15:00:00Z"));

  const { claimedIds } = await claimScheduledPushes(deps, 2, SCHEDULED_PUSH_LEASE_MS);
  assert(claimedIds.length === 2, "claims 2 rows (batchSize)");
  assert(claimedIds[0] === "push_early", "first claimed is earliest scheduled");
  assert(claimedIds[1] === "push_mid", "second claimed is next earliest");
}

async function testReclaimSetsLastError() {
  const prisma = new FakePrisma();
  prisma.rows.set("push_1", makeRow({
    id: "push_1",
    status: "PROCESSING",
    claimToken: "old_tok",
    claimedAt: new Date("2026-08-08T11:00:00Z"), // 1hr ago, stale
  }));
  const deps = makeDeps(prisma, new Date("2026-08-08T12:00:00Z"));

  await claimScheduledPushes(deps, 20, SCHEDULED_PUSH_LEASE_MS);
  // After reclaim, the row is PENDING with lastError set, then re-claimed to PROCESSING
  // The reclaim updateMany sets lastError, then the claim updateMany clears it.
  // Verify the row ended up PROCESSING with a new token.
  assert(prisma.rows.get("push_1")!.status === "PROCESSING", "stale row re-claimed");
  assert(prisma.rows.get("push_1")!.claimToken !== "old_tok", "new token assigned");
}

// ─── Run ──────────────────────────────────────────────────────────────────

async function main() {
  await testClaimDuePending();
  await testClaimRespectsBatchSize();
  await testClaimSkipsFutureScheduled();
  await testClaimSkipsNonPending();
  await testReclaimStaleProcessing();
  await testNoReclaimFreshProcessing();
  await testPreservesTerminalStates();
  await testProcessClaimedSends();
  await testProcessSkipsLostClaim();
  await testProcessSkipsNonProcessing();
  await testProcessBroadcastFailureMarksFailed();
  await testProcessEmptyClaimedIds();
  await testClaimOrderingByScheduledFor();
  await testReclaimSetsLastError();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("All scheduled-push-claim tests passed.");
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exitCode = 1;
});
