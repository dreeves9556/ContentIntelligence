/**
 * Pure claim-decision logic for calendar generation idempotency.
 *
 * Extracted from `generateWeeklyCalendar` in
 * `src/app/dashboard/calendar/actions.ts` so it can be unit-tested without a
 * database. The action calls `decideCalendarClaim` with the existing row (or
 * null for a fresh request) and acts on the returned decision; the test
 * exercises this pure function directly.
 *
 * The state machine:
 *   - No existing row → CLAIM_NEW (insert a PROCESSING row).
 *   - COMPLETED → return the cached calendar (duplicate).
 *   - PROCESSING + stale → RECLAIM (conditional updateMany on the old token).
 *   - PROCESSING + fresh → IN_PROGRESS (another worker is alive).
 *   - FAILED + params match → RECLAIM (conditional updateMany on FAILED).
 *   - FAILED + params mismatch → PARAM_MISMATCH.
 *   - Unknown status → IN_PROGRESS (safe default).
 *
 * Transaction-isolation and true concurrency guarantees (Serializable
 * isolation, conditional updateMany races) require a real PostgreSQL
 * integration test. The unit tests here exercise the pure decision logic;
 * staging concurrency QA is still required.
 */

export const CALENDAR_CLAIM_LEASE_MS = 120_000;
export const CALENDAR_HEARTBEAT_INTERVAL_MS = 30_000;

export interface CalendarClaimExistingRow {
  id: string;
  requestStatus: "PROCESSING" | "COMPLETED" | "FAILED" | string;
  requestClaimToken: string | null;
  requestClaimedAt: Date | null;
  requestDaysToPost: number | null;
  requestTimezoneOffset: number | null;
  requestUserId: string | null;
  resultingCalendarId: string | null;
}

export interface CalendarClaimRequest {
  requestId: string;
  userId: string;
  daysToPost: number;
  timezoneOffsetHours: number;
}

export type CalendarClaimDecision =
  | { kind: "CLAIM_NEW" }
  | { kind: "COMPLETED"; calendarId: string | null }
  | { kind: "IN_PROGRESS" }
  | { kind: "RECLAIM"; rowId: string; fromStatus: "PROCESSING" | "FAILED" }
  | { kind: "PARAM_MISMATCH" };

/**
 * Decide how to proceed given an existing CalendarGenerationLog row (or null
 * for a fresh request) and the current request parameters.
 *
 * Pure: no DB access, no side effects. The caller performs the actual
 * insert/updateMany based on the decision.
 */
export function decideCalendarClaim(
  existing: CalendarClaimExistingRow | null,
  request: CalendarClaimRequest,
  now: Date,
  leaseMs: number = CALENDAR_CLAIM_LEASE_MS
): CalendarClaimDecision {
  if (!existing) {
    return { kind: "CLAIM_NEW" };
  }

  if (existing.requestStatus === "COMPLETED") {
    return { kind: "COMPLETED", calendarId: existing.resultingCalendarId };
  }

  if (existing.requestStatus === "PROCESSING") {
    const stale =
      !existing.requestClaimedAt ||
      now.getTime() - existing.requestClaimedAt.getTime() > leaseMs;
    if (stale) {
      return { kind: "RECLAIM", rowId: existing.id, fromStatus: "PROCESSING" };
    }
    return { kind: "IN_PROGRESS" };
  }

  if (existing.requestStatus === "FAILED") {
    if (
      existing.requestDaysToPost !== request.daysToPost ||
      existing.requestTimezoneOffset !== request.timezoneOffsetHours ||
      existing.requestUserId !== request.userId
    ) {
      return { kind: "PARAM_MISMATCH" };
    }
    return { kind: "RECLAIM", rowId: existing.id, fromStatus: "FAILED" };
  }

  // Unknown status — treat as in-progress (safe default).
  return { kind: "IN_PROGRESS" };
}

/**
 * Validate a calendar-generation requestId. Returns true if it is a valid UUID.
 * The action rejects malformed/missing requestIds to prevent idempotency bypass.
 */
export function isValidCalendarRequestId(requestId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId);
}
