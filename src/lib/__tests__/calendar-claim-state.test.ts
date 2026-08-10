// Tests for the calendar-generation claim state machine.
// Run: npx tsx src/lib/__tests__/calendar-claim-state.test.ts
//
// Exercises the real `decideCalendarClaim` and `isValidCalendarRequestId`
// from src/lib/calendar-claim-service.ts. No algorithm is copied — the test
// drives the production decision function with synthetic rows.
//
// Transaction-isolation and true concurrency guarantees (Serializable
// isolation, conditional updateMany races) require a real PostgreSQL
// integration test. The unit tests here exercise the pure decision logic;
// staging concurrency QA is still required.

import {
  decideCalendarClaim,
  isValidCalendarRequestId,
  CALENDAR_CLAIM_LEASE_MS,
  type CalendarClaimExistingRow,
} from "../calendar-claim-service";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

const NOW = new Date("2026-08-08T12:00:00Z");
const LEASE = CALENDAR_CLAIM_LEASE_MS; // 120_000

function makeRow(overrides: Partial<CalendarClaimExistingRow> = {}): CalendarClaimExistingRow {
  return {
    id: "log_1",
    requestStatus: "PROCESSING",
    requestClaimToken: "token_abc",
    requestClaimedAt: NOW,
    requestDaysToPost: 3,
    requestTimezoneOffset: -5,
    requestUserId: "user_1",
    resultingCalendarId: null,
    ...overrides,
  };
}

const baseRequest = {
  requestId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  userId: "user_1",
  daysToPost: 3,
  timezoneOffsetHours: -5,
};

// ─── Tests ────────────────────────────────────────────────────────────────

function testNewClaim() {
  const decision = decideCalendarClaim(null, baseRequest, NOW, LEASE);
  assert(decision.kind === "CLAIM_NEW", "no existing row → CLAIM_NEW");
}

function testDuplicateCompleted() {
  const row = makeRow({
    requestStatus: "COMPLETED",
    resultingCalendarId: "cal_123",
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "COMPLETED", "COMPLETED row → COMPLETED");
  assert((decision as { calendarId: string }).calendarId === "cal_123", "COMPLETED returns calendarId");
}

function testDuplicateCompletedNoCalendar() {
  const row = makeRow({
    requestStatus: "COMPLETED",
    resultingCalendarId: null,
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "COMPLETED", "COMPLETED with no calendar → COMPLETED");
  assert((decision as { calendarId: string | null }).calendarId === null, "COMPLETED null calendarId");
}

function testFreshProcessing() {
  const row = makeRow({
    requestStatus: "PROCESSING",
    requestClaimedAt: new Date(NOW.getTime() - 30_000), // 30s ago, fresh
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "IN_PROGRESS", "fresh PROCESSING → IN_PROGRESS");
}

function testStaleReclaim() {
  const row = makeRow({
    requestStatus: "PROCESSING",
    requestClaimedAt: new Date(NOW.getTime() - LEASE - 1000), // stale
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "RECLAIM", "stale PROCESSING → RECLAIM");
  assert((decision as { fromStatus: string }).fromStatus === "PROCESSING", "RECLAIM fromStatus PROCESSING");
}

function testStaleReclaimNullClaimedAt() {
  const row = makeRow({
    requestStatus: "PROCESSING",
    requestClaimedAt: null,
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "RECLAIM", "PROCESSING with null claimedAt → RECLAIM");
}

function testFailedReclaimMatchingParams() {
  const row = makeRow({
    requestStatus: "FAILED",
    requestDaysToPost: 3,
    requestTimezoneOffset: -5,
    requestUserId: "user_1",
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "RECLAIM", "FAILED with matching params → RECLAIM");
  assert((decision as { fromStatus: string }).fromStatus === "FAILED", "RECLAIM fromStatus FAILED");
}

function testFailedReclaimParamMismatchDays() {
  const row = makeRow({
    requestStatus: "FAILED",
    requestDaysToPost: 5, // different
    requestTimezoneOffset: -5,
    requestUserId: "user_1",
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "PARAM_MISMATCH", "FAILED with different daysToPost → PARAM_MISMATCH");
}

function testFailedReclaimParamMismatchTz() {
  const row = makeRow({
    requestStatus: "FAILED",
    requestDaysToPost: 3,
    requestTimezoneOffset: 0, // different
    requestUserId: "user_1",
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "PARAM_MISMATCH", "FAILED with different timezone → PARAM_MISMATCH");
}

function testFailedReclaimParamMismatchUser() {
  const row = makeRow({
    requestStatus: "FAILED",
    requestDaysToPost: 3,
    requestTimezoneOffset: -5,
    requestUserId: "user_other", // different
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "PARAM_MISMATCH", "FAILED with different userId → PARAM_MISMATCH");
}

function testUnknownStatus() {
  const row = makeRow({
    requestStatus: "WEIRD",
  });
  const decision = decideCalendarClaim(row, baseRequest, NOW, LEASE);
  assert(decision.kind === "IN_PROGRESS", "unknown status → IN_PROGRESS (safe default)");
}

function testRequestIdValidation() {
  assert(isValidCalendarRequestId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), "valid UUID accepted");
  assert(!isValidCalendarRequestId(""), "empty requestId rejected");
  assert(!isValidCalendarRequestId("not-a-uuid"), "non-UUID rejected");
  assert(!isValidCalendarRequestId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa"), "too-short UUID rejected");
  assert(isValidCalendarRequestId("AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA"), "uppercase UUID accepted");
}

// ─── Run ──────────────────────────────────────────────────────────────────

function main() {
  testNewClaim();
  testDuplicateCompleted();
  testDuplicateCompletedNoCalendar();
  testFreshProcessing();
  testStaleReclaim();
  testStaleReclaimNullClaimedAt();
  testFailedReclaimMatchingParams();
  testFailedReclaimParamMismatchDays();
  testFailedReclaimParamMismatchTz();
  testFailedReclaimParamMismatchUser();
  testUnknownStatus();
  testRequestIdValidation();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("All calendar-claim-state tests passed.");
  }
}

main();
