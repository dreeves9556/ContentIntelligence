import {
  shouldBlockDashboardAccess,
  shouldDowngradeToCalendarOnly,
  type AccountAccessUser,
} from "@/lib/account-access";
import type { UserPlan } from "@/lib/tiers";

export function evaluateDashboardAccess(
  user: AccountAccessUser & { plan: UserPlan },
  requiredPlan?: UserPlan
): { allowed: true; effectivePlan: UserPlan } | { allowed: false; error: string } {
  if (shouldBlockDashboardAccess(user)) {
    return { allowed: false, error: "Account access is inactive" };
  }

  const effectivePlan = shouldDowngradeToCalendarOnly(user)
    ? "CALENDAR_ONLY"
    : user.plan;

  if (
    user.role !== "ADMIN" &&
    requiredPlan &&
    effectivePlan !== requiredPlan
  ) {
    return { allowed: false, error: "Your plan does not include this feature" };
  }

  return { allowed: true, effectivePlan };
}
