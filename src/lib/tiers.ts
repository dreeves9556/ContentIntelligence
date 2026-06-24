export type UserPlan = "CALENDAR_ONLY" | "CREATOR" | "PRO";

export const PLAN_LABELS: Record<UserPlan, string> = {
  CALENDAR_ONLY: "Calendar Only",
  CREATOR: "Creator",
  PRO: "Pro",
};

export const CREATOR_ACCOUNT_LIMIT = 2;

export function canAccessAnalytics(plan: UserPlan): boolean {
  return plan === "CREATOR" || plan === "PRO";
}

export function canAccessIntegrations(plan: UserPlan): boolean {
  return plan === "CREATOR" || plan === "PRO";
}

export function hasUnlimitedAccounts(plan: UserPlan): boolean {
  return plan === "PRO";
}
