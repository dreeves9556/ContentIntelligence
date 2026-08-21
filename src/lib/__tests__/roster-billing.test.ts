import {
  deriveRosterBillingSource,
  deriveRosterLifecycle,
  getRosterNextChange,
  isCancellationScheduled,
} from "../roster-billing";

let failures = 0;
const now = new Date("2026-08-21T12:00:00Z");

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

function input(overrides: Partial<Parameters<typeof deriveRosterLifecycle>[0]> = {}) {
  return {
    accountStatus: "ACTIVE",
    isComped: false,
    organizationId: null,
    stripeSubscriptionId: "sub_1",
    stripeStatus: "active",
    stripeCancelAt: null,
    stripeCurrentPeriodEnd: new Date("2026-09-21T12:00:00Z"),
    trialEndsAt: null,
    ...overrides,
  };
}

assert(deriveRosterLifecycle(input(), now) === "ACTIVE", "active paid user is Active");
assert(
  deriveRosterLifecycle(input({ stripeStatus: "trialing", trialEndsAt: new Date("2026-08-28T12:00:00Z") }), now) === "TRIAL",
  "trialing user is Trial"
);
assert(
  deriveRosterLifecycle(input({ stripeStatus: "cancel_at_period_end" }), now) === "CANCELING",
  "period-end cancellation is Canceling"
);
assert(
  deriveRosterLifecycle(input({ stripeCancelAt: new Date("2026-09-01T12:00:00Z") }), now) === "CANCELING",
  "explicit cancellation date is Canceling"
);
assert(
  deriveRosterLifecycle(input({ accountStatus: "ARCHIVED", stripeSubscriptionId: null, stripeStatus: null }), now) === "ARCHIVED",
  "archived user is Archived"
);
assert(
  deriveRosterLifecycle(input({ isComped: true, stripeSubscriptionId: null, stripeStatus: null }), now) === "ACTIVE",
  "comped user keeps active access lifecycle"
);
assert(
  deriveRosterBillingSource(input({ isComped: true })) === "COMPED",
  "comped user has Comped billing source"
);
assert(
  deriveRosterBillingSource(input({ organizationId: "org_1" })) === "COMMUNITY",
  "organization member has Community billing source"
);
assert(
  isCancellationScheduled(
    { stripeStatus: "active", stripeCancelAt: new Date("2026-08-20T12:00:00Z") },
    now
  ) === false,
  "past explicit cancellation is not scheduled"
);
const next = getRosterNextChange(
  input({ stripeStatus: "cancel_at_period_end" }),
  "CANCELING",
  now
);
assert(next.label === "Cancels · no renewal", "canceling next change warns about renewal");
assert(next.date?.toISOString() === "2026-09-21T12:00:00.000Z", "canceling uses period end date");

if (failures > 0) process.exitCode = 1;
