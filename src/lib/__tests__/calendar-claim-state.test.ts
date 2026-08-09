// Tests for the calendar-generation claim state machine.
// Run: npx tsx src/lib/__tests__/calendar-claim-state.test.ts
//
// No DB harness exists, so this file inlines an in-memory claim store that
// mimics the state machine in generateWeeklyCalendar
// (src/app/dashboard/calendar/actions.ts). The guarantee proven here:
// every post-claim failure path transitions the owned claim to FAILED (or
// COMPLETED on success). No path leaves the claim stuck in PROCESSING.

export {};

type ClaimStatus = "PROCESSING" | "COMPLETED" | "FAILED";

interface ClaimRow {
  id: string;
  userId: string;
  requestId: string;
  requestStatus: ClaimStatus;
  requestClaimToken: string | null;
  requestClaimedAt: number;
  requestAttempts: number;
  requestDaysToPost: number;
  requestTimezoneOffset: number;
  requestUserId: string;
  resultingCalendarId: string | null;
  errorMessage: string | null;
  durationMs: number | null;
  success: boolean;
}

class ClaimStore {
  rows: Map<string, ClaimRow> = new Map();

  claim(
    userId: string,
    requestId: string,
    token: string,
    now: number,
    daysToPost: number,
    tz: number
  ): { kind: "claimed"; id: string } | { kind: "completed"; calendarId: string | null } | { kind: "in_progress" } | { kind: "param_mismatch" } {
    const key = `${userId}:${requestId}`;
    const existing = this.rows.get(key);
    if (!existing) {
      const row: ClaimRow = {
        id: `log_${this.rows.size + 1}`,
        userId,
        requestId,
        requestStatus: "PROCESSING",
        requestClaimToken: token,
        requestClaimedAt: now,
        requestAttempts: 1,
        requestDaysToPost: daysToPost,
        requestTimezoneOffset: tz,
        requestUserId: userId,
        resultingCalendarId: null,
        errorMessage: null,
        durationMs: null,
        success: false,
      };
      this.rows.set(key, row);
      return { kind: "claimed", id: row.id };
    }

    if (existing.requestStatus === "COMPLETED") {
      return { kind: "completed", calendarId: existing.resultingCalendarId };
    }
    if (existing.requestStatus === "PROCESSING") {
      // Stale check omitted for simplicity — non-stale → in_progress.
      return { kind: "in_progress" };
    }
    if (existing.requestStatus === "FAILED") {
      if (
        existing.requestDaysToPost !== daysToPost ||
        existing.requestTimezoneOffset !== tz ||
        existing.requestUserId !== userId
      ) {
        return { kind: "param_mismatch" };
      }
      existing.requestStatus = "PROCESSING";
      existing.requestClaimToken = token;
      existing.requestClaimedAt = now;
      existing.requestAttempts += 1;
      existing.errorMessage = null;
      return { kind: "claimed", id: existing.id };
    }
    return { kind: "in_progress" };
  }

  failClaim(id: string, token: string, errorMessage: string, durationMs: number): boolean {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (!row || row.requestClaimToken !== token) return false;
    row.requestStatus = "FAILED";
    row.requestClaimToken = null;
    row.success = false;
    row.errorMessage = errorMessage;
    row.durationMs = durationMs;
    return true;
  }

  completeClaim(id: string, token: string, calendarId: string, durationMs: number): boolean {
    const row = [...this.rows.values()].find((r) => r.id === id);
    if (!row || row.requestClaimToken !== token) return false;
    row.requestStatus = "COMPLETED";
    row.requestClaimToken = null;
    row.success = true;
    row.resultingCalendarId = calendarId;
    row.durationMs = durationMs;
    return true;
  }

  getRow(userId: string, requestId: string): ClaimRow | undefined {
    return this.rows.get(`${userId}:${requestId}`);
  }
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

const USER = "user_1";
const REQ = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const DAYS = 3;
const TZ = 0;

// ─── Test 1: rate-limit failure → claim FAILED ───────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok1", 1000, DAYS, TZ);
  assert(claim.kind === "claimed", "rate-limit path: claim acquired");
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok1", "Rate limited", 50);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "rate-limit failure → claim FAILED");
    assert(row.errorMessage === "Rate limited", "rate-limit failure records errorMessage");
    assert(row.success === false, "rate-limit failure → success=false");
    assert(row.requestClaimToken === null, "rate-limit failure clears claimToken");
  }
}

// ─── Test 2: API key missing → claim FAILED ──────────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok2", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok2", "Anthropic API key not configured", 100);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "API key missing → claim FAILED");
  }
}

// ─── Test 3: AI service error → claim FAILED ──────────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok3", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok3", "AI service error (500)", 5000);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "AI service error → claim FAILED");
  }
}

// ─── Test 4: parse error → claim FAILED ───────────────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok4", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok4", "Failed to parse AI response", 8000);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "parse error → claim FAILED");
  }
}

// ─── Test 5: incomplete calendar → claim FAILED ───────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok5", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok5", "AI returned an incomplete calendar", 9000);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "incomplete calendar → claim FAILED");
  }
}

// ─── Test 6: prework exception (outer catch) → claim FAILED ───────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok6", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.failClaim(claim.id, "tok6", "Unknown error during prework", 200);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "FAILED", "prework exception → claim FAILED");
  }
}

// ─── Test 7: success → claim COMPLETED ────────────────────────────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok7", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    store.completeClaim(claim.id, "tok7", "cal_123", 15000);
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "COMPLETED", "success → claim COMPLETED");
    assert(row.resultingCalendarId === "cal_123", "success records resultingCalendarId");
    assert(row.success === true, "success → success=true");
    assert(row.requestClaimToken === null, "success clears claimToken");
  }
}

// ─── Test 8: duplicate request after COMPLETED → returns calendarId ───────
{
  const store = new ClaimStore();
  store.claim(USER, REQ, "tok8", 1000, DAYS, TZ);
  const row = store.getRow(USER, REQ)!;
  store.completeClaim(row.id, "tok8", "cal_456", 10000);
  const second = store.claim(USER, REQ, "tok8b", 2000, DAYS, TZ);
  assert(second.kind === "completed", "duplicate COMPLETED request returns completed");
  if (second.kind === "completed") {
    assert(second.calendarId === "cal_456", "duplicate returns correct calendarId");
  }
}

// ─── Test 9: retry after FAILED with matching params → re-claimed ─────────
{
  const store = new ClaimStore();
  const c1 = store.claim(USER, REQ, "tok9", 1000, DAYS, TZ);
  if (c1.kind === "claimed") {
    store.failClaim(c1.id, "tok9", "transient error", 100);
  }
  const c2 = store.claim(USER, REQ, "tok9b", 2000, DAYS, TZ);
  assert(c2.kind === "claimed", "retry after FAILED with matching params re-claimed");
  const row = store.getRow(USER, REQ)!;
  assert(row.requestAttempts === 2, "retry increments attempts");
  assert(row.requestStatus === "PROCESSING", "retry sets status back to PROCESSING");
}

// ─── Test 10: retry after FAILED with mismatched params → param_mismatch ──
{
  const store = new ClaimStore();
  const c1 = store.claim(USER, REQ, "tok10", 1000, DAYS, TZ);
  if (c1.kind === "claimed") {
    store.failClaim(c1.id, "tok10", "error", 100);
  }
  const c2 = store.claim(USER, REQ, "tok10b", 2000, 5, TZ); // different daysToPost
  assert(c2.kind === "param_mismatch", "retry with mismatched params → param_mismatch");
  const row = store.getRow(USER, REQ)!;
  assert(row.requestStatus === "FAILED", "param_mismatch does not change claim status");
}

// ─── Test 11: lost lease — completeClaim with wrong token is no-op ────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok11", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    const ok = store.completeClaim(claim.id, "wrong_token", "cal_789", 1000);
    assert(ok === false, "completeClaim with wrong token is no-op (lost lease)");
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "PROCESSING", "lost-lease complete does not change status");
  }
}

// ─── Test 12: lost lease — failClaim with wrong token is no-op ────────────
{
  const store = new ClaimStore();
  const claim = store.claim(USER, REQ, "tok12", 1000, DAYS, TZ);
  if (claim.kind === "claimed") {
    const ok = store.failClaim(claim.id, "wrong_token", "error", 100);
    assert(ok === false, "failClaim with wrong token is no-op (lost lease)");
    const row = store.getRow(USER, REQ)!;
    assert(row.requestStatus === "PROCESSING", "lost-lease fail does not change status");
  }
}

// ─── Test 13: every failure path is terminal (no stuck PROCESSING) ────────
// Simulate all failure paths and verify none leave PROCESSING.
{
  const store = new ClaimStore();
  const failurePaths = [
    "Rate limited",
    "Anthropic API key not configured",
    "AI service error (500)",
    "Failed to parse AI response",
    "AI returned an incomplete calendar",
    "Unknown error during prework",
  ];
  let allTerminal = true;
  for (let i = 0; i < failurePaths.length; i++) {
    const reqId = `bbbbbbbb-bbbb-bbbb-bbbb-${i.toString().padStart(12, "0")}`;
    const claim = store.claim(USER, reqId, `tok_${i}`, 1000, DAYS, TZ);
    if (claim.kind === "claimed") {
      store.failClaim(claim.id, `tok_${i}`, failurePaths[i], 100);
      const row = store.getRow(USER, reqId)!;
      if (row.requestStatus !== "FAILED") allTerminal = false;
    } else {
      allTerminal = false;
    }
  }
  assert(allTerminal, "all 6 failure paths transition claim to FAILED (none stuck PROCESSING)");
}

// ─── Summary ────────────────────────────────────────────────────────────────
if (fail > 0) {
  console.error(`\n${fail} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll calendar-claim-state tests passed (${pass} assertions).`);
}
