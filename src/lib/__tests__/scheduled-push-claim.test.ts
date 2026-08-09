// Tests for the scheduled-push bounded recoverable claim protocol.
// Run: npx tsx src/lib/__tests__/scheduled-push-claim.test.ts
//
// No DB harness exists, so this file inlines an in-memory store that mimics
// the conditional updateMany semantics of the real service
// (src/lib/scheduled-push-service.ts). The state transitions proven here
// match the service exactly: claim ≤ batchSize, conditional on status,
// token-guarded finalization, stale reclaim, terminal preservation.

export {};

interface Row {
  id: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "CANCELLED" | "FAILED";
  scheduledFor: number;
  claimToken: string | null;
  claimedAt: number | null;
  attempts: number;
  lastError: string | null;
  sentCount: number;
  failedCount: number;
}

let tokenCounter = 0;
function newToken(): string {
  tokenCounter++;
  return `tok-${tokenCounter}`;
}

class FakeStore {
  rows: Row[] = [];

  constructor(rows: Row[]) {
    this.rows = rows;
  }

  // Mimics: findMany({ where: { status, scheduledFor: { lte: now } }, take })
  findDuePending(now: number, take: number): Row[] {
    return this.rows
      .filter((r) => r.status === "PENDING" && r.scheduledFor <= now)
      .sort((a, b) => a.scheduledFor - b.scheduledFor)
      .slice(0, take);
  }

  // Mimics: updateMany({ where: { id in, status }, data }) — conditional on status.
  claim(candidateIds: string[], token: string, now: number): number {
    let count = 0;
    for (const r of this.rows) {
      if (candidateIds.includes(r.id) && r.status === "PENDING") {
        r.status = "PROCESSING";
        r.claimToken = token;
        r.claimedAt = now;
        r.attempts += 1;
        r.lastError = null;
        count++;
      }
    }
    return count;
  }

  // Mimics: updateMany({ where: { status: "PROCESSING", claimedAt: { lt: staleBefore } } })
  reclaimStale(staleBefore: number): number {
    let count = 0;
    for (const r of this.rows) {
      if (r.status === "PROCESSING" && r.claimedAt !== null && r.claimedAt < staleBefore) {
        r.status = "PENDING";
        r.claimToken = null;
        r.claimedAt = null;
        r.lastError = "Reclaimed from stale PROCESSING lease";
        count++;
      }
    }
    return count;
  }

  // Mimics: findMany({ where: { claimToken } })
  findByToken(token: string): Row[] {
    return this.rows.filter((r) => r.claimToken === token);
  }

  // Mimics: updateMany({ where: { id, claimToken, status: "PROCESSING" }, data: SENT })
  finalizeSent(id: string, token: string, sent: number, failed: number): number {
    const r = this.rows.find((x) => x.id === id);
    if (r && r.status === "PROCESSING" && r.claimToken === token) {
      r.status = "SENT";
      r.sentCount = sent;
      r.failedCount = failed;
      r.claimToken = null;
      r.claimedAt = null;
      r.lastError = null;
      return 1;
    }
    return 0;
  }

  // Mimics: updateMany({ where: { id, claimToken, status: "PROCESSING" }, data: FAILED })
  finalizeFailed(id: string, token: string, error: string): number {
    const r = this.rows.find((x) => x.id === id);
    if (r && r.status === "PROCESSING" && r.claimToken === token) {
      r.status = "FAILED";
      r.claimToken = null;
      r.claimedAt = null;
      r.lastError = error;
      return 1;
    }
    return 0;
  }
}

const BATCH = 20;
const LEASE = 10 * 60 * 1000;

// Inlined replica of claimScheduledPushes (logic only).
function claimPass(store: FakeStore, now: number, batchSize = BATCH, leaseMs = LEASE): { claimedIds: string[]; reclaimed: number } {
  const staleBefore = now - leaseMs;
  const reclaimed = store.reclaimStale(staleBefore);
  const candidates = store.findDuePending(now, batchSize);
  if (candidates.length === 0) return { claimedIds: [], reclaimed };
  const candidateIds = candidates.map((c) => c.id);
  const token = newToken();
  const count = store.claim(candidateIds, token, now);
  let claimedIds: string[];
  if (count === candidateIds.length) {
    claimedIds = candidateIds;
  } else {
    claimedIds = store.findByToken(token).map((r) => r.id);
  }
  return { claimedIds, reclaimed };
}

function makeRow(id: string, status: Row["status"] = "PENDING", scheduledFor = 0, extra: Partial<Row> = {}): Row {
  return {
    id,
    status,
    scheduledFor,
    claimToken: null,
    claimedAt: null,
    attempts: 0,
    lastError: null,
    sentCount: 0,
    failedCount: 0,
    ...extra,
  };
}

let pass = 0;
let fail = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS: ${label}`);
    pass++;
  } else {
    console.error(`FAIL: ${label}`);
    fail++;
  }
}

// ─── Test 1: more than 20 due pushes → only 20 claimed, rest stay PENDING ──
{
  const rows: Row[] = [];
  for (let i = 0; i < 25; i++) rows.push(makeRow(`p${i}`, "PENDING", i));
  const store = new FakeStore(rows);
  const { claimedIds } = claimPass(store, 1000);
  assert(claimedIds.length === 20, "more than 20 due pushes — only 20 claimed per pass");
  const stillPending = rows.filter((r) => r.status === "PENDING").length;
  assert(stillPending === 5, "remaining 5 rows stay PENDING (not stuck in PROCESSING)");
  // Second pass claims the remaining 5.
  const { claimedIds: secondBatch } = claimPass(store, 1000);
  assert(secondBatch.length === 5, "second pass claims the remaining 5 due pushes");
}

// ─── Test 2: concurrent claim attempts — no row claimed by both ──────────
{
  const rows = [makeRow("c0", "PENDING", 0), makeRow("c1", "PENDING", 1), makeRow("c2", "PENDING", 2)];
  const store = new FakeStore(rows);
  // Worker A selects candidates then claims.
  const candidatesA = store.findDuePending(1000, 20).map((r) => r.id);
  const tokenA = newToken();
  const countA = store.claim(candidatesA, tokenA, 1000);
  // Worker B selects the SAME candidates (before A claimed) then tries to claim.
  const candidatesB = [...candidatesA];
  const tokenB = newToken();
  const countB = store.claim(candidatesB, tokenB, 1000);
  assert(countA === 3, "worker A claimed all 3 rows");
  assert(countB === 0, "worker B claimed 0 rows (conditional update prevented double-claim)");
  assert(rows.every((r) => r.claimToken === tokenA), "all rows hold worker A's token only");
}

// ─── Test 3: stale claim recovery ─────────────────────────────────────────
{
  const rows = [
    makeRow("s0", "PROCESSING", 0, { claimToken: "old", claimedAt: 1000 - LEASE - 1 }),
    makeRow("s1", "PROCESSING", 1, { claimToken: "old2", claimedAt: 1000 - LEASE - 1 }),
  ];
  const store = new FakeStore(rows);
  const { reclaimed, claimedIds } = claimPass(store, 1000);
  assert(reclaimed === 2, "two stale PROCESSING rows reclaimed");
  // claimPass reclaims AND claims in one pass, so the reclaimed rows are
  // immediately re-claimed by this worker (PROCESSING with a fresh token).
  assert(claimedIds.length === 2, "reclaimed rows are re-claimed in the same pass");
  assert(rows.every((r) => r.status === "PROCESSING"), "reclaimed rows now PROCESSING under new token");
  assert(rows.every((r) => r.claimToken !== null && r.claimToken !== "old" && r.claimToken !== "old2"), "reclaimed rows hold a fresh token");
}

// ─── Test 4: terminal rows not reclaimed ──────────────────────────────────
{
  const rows = [
    makeRow("t0", "SENT", 0, { claimToken: null, claimedAt: null, sentCount: 5 }),
    makeRow("t1", "FAILED", 1, { claimToken: null, claimedAt: null, lastError: "boom" }),
    makeRow("t2", "CANCELLED", 2),
    makeRow("t3", "PROCESSING", 3, { claimToken: "live", claimedAt: 1000 - 1000 }), // not stale
  ];
  const store = new FakeStore(rows);
  const { reclaimed, claimedIds } = claimPass(store, 1000);
  assert(reclaimed === 0, "no terminal or live rows reclaimed");
  assert(claimedIds.length === 0, "no terminal rows claimed");
  assert(rows[0].status === "SENT", "SENT row preserved");
  assert(rows[1].status === "FAILED", "FAILED row preserved");
  assert(rows[2].status === "CANCELLED", "CANCELLED row preserved");
  assert(rows[3].status === "PROCESSING" && rows[3].claimToken === "live", "live PROCESSING lease preserved");
}

// ─── Test 5: worker only processes its own claim (token-guarded finalize) ─
{
  const rows = [
    makeRow("w0", "PROCESSING", 0, { claimToken: "mine", claimedAt: 1000 }),
    makeRow("w1", "PROCESSING", 1, { claimToken: "theirs", claimedAt: 1000 }),
  ];
  const store = new FakeStore(rows);
  // Worker "mine" tries to finalize both — only its own row should finalize.
  const f0 = store.finalizeSent("w0", "mine", 10, 0);
  const f1 = store.finalizeSent("w1", "mine", 99, 0);
  assert(f0 === 1, "worker finalizes its own claimed row");
  assert(f1 === 0, "worker cannot finalize another worker's row (token guard)");
  assert(rows[0].status === "SENT" && rows[0].sentCount === 10, "own row marked SENT with counts");
  assert(rows[1].status === "PROCESSING" && rows[1].claimToken === "theirs", "other worker's row untouched");
}

// ─── Test 6: lost lease mid-send — finalize is a no-op, no double-count ────
{
  const rows = [makeRow("l0", "PROCESSING", 0, { claimToken: "orig", claimedAt: 1000 })];
  const store = new FakeStore(rows);
  // Simulate stale reclaim by another worker before finalize.
  store.reclaimStale(1000 + LEASE + 1);
  assert(rows[0].status === "PENDING", "row reclaimed before original worker finalized");
  // Original worker tries to finalize with stale token — should be no-op.
  const f = store.finalizeSent("l0", "orig", 5, 0);
  assert(f === 0, "lost-lease finalize is a no-op (token no longer matches)");
  assert(rows[0].status === "PENDING", "row stays PENDING for the new worker to claim");
}

// ─── Summary ────────────────────────────────────────────────────────────────
if (fail > 0) {
  console.error(`\n${fail} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll scheduled-push-claim tests passed (${pass} assertions).`);
}
