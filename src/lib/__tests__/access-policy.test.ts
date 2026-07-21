import { evaluateDashboardAccess } from "../access-policy";
import type { AccountAccessUser } from "../account-access";
import type { UserPlan } from "../tiers";

function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function user(
  overrides: Partial<AccountAccessUser & { plan: UserPlan }> = {}
): AccountAccessUser & { plan: UserPlan } {
  return {
    id: "user-1",
    role: "USER",
    plan: "PRO",
    accountStatus: "ACTIVE",
    accessExpiresAt: null,
    expirationAction: "NONE",
    isComped: false,
    internalTag: null,
    ...overrides,
  };
}

assert(evaluateDashboardAccess(user(), "PRO").allowed, "active PRO user is allowed");
assert(
  !evaluateDashboardAccess(user({ accountStatus: "ARCHIVED" }), "PRO").allowed,
  "archived user is blocked"
);
assert(
  !evaluateDashboardAccess(user({ accountStatus: "PAST_DUE" }), "PRO").allowed,
  "past-due user is blocked"
);
assert(
  !evaluateDashboardAccess(user({ accountStatus: "CANCELED" }), "PRO").allowed,
  "canceled user is blocked"
);
assert(
  !evaluateDashboardAccess(user({ plan: "CALENDAR_ONLY" }), "PRO").allowed,
  "calendar-only user cannot invoke PRO operation"
);
assert(
  evaluateDashboardAccess(user({ plan: "CALENDAR_ONLY" })).allowed,
  "calendar-only user can invoke base calendar operation"
);
assert(
  !evaluateDashboardAccess(
    user({
      accessExpiresAt: new Date(Date.now() - 60_000),
      expirationAction: "DOWNGRADE_TO_CALENDAR_ONLY",
    }),
    "PRO"
  ).allowed,
  "expired downgrade loses PRO entitlement immediately"
);
assert(
  evaluateDashboardAccess(
    user({ role: "ADMIN", accountStatus: "ARCHIVED", plan: "CALENDAR_ONLY" }),
    "PRO"
  ).allowed,
  "global admin bypasses account and plan restrictions"
);
