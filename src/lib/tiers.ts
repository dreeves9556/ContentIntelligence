/**
 * Subscription Tiers & Role Helpers
 *
 * Roles:
 *   USER        — Standard creator. Belongs to 0 or 1 organization.
 *   TEAM_ADMIN  — Org-scoped admin. Can invite/remove members, view roster.
 *                 Blocked from /admin/* by proxy.ts + auth.config.ts.
 *                 Must have an organizationId (enforced in updateUserRole).
 *   ADMIN       — Global admin. Full access to /admin/*, manages all orgs.
 *                 organizationId is cleared when promoted to ADMIN.
 *
 * Plans:
 *   CALENDAR_ONLY — Content calendar only, no analytics or integrations.
 *   CREATOR       — Calendar + analytics + integrations (max 2 social accounts).
 *   PRO           — Everything unlimited.
 *
 * Plan inheritance: Org members inherit the org's seatPlan. When an admin
 * changes the org's seatPlan, all non-ADMIN members are updated atomically
 * in a transaction (see admin/organizations/actions.ts).
 */

export type UserPlan = "CALENDAR_ONLY" | "CREATOR" | "PRO";

export type UserRole = "USER" | "TEAM_ADMIN" | "ADMIN";

export const PLAN_LABELS: Record<UserPlan, string> = {
  CALENDAR_ONLY: "Calendar Only",
  CREATOR: "Creator",
  PRO: "Pro",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  USER: "Client",
  TEAM_ADMIN: "Team Admin",
  ADMIN: "Admin",
};

export const CREATOR_ACCOUNT_LIMIT = 2;

export function isAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}

export function isTeamAdmin(role: string | undefined | null): boolean {
  return role === "TEAM_ADMIN";
}

export function canAccessAnalytics(plan: UserPlan): boolean {
  return plan === "CREATOR" || plan === "PRO";
}

export function canAccessIntegrations(plan: UserPlan): boolean {
  return plan === "CREATOR" || plan === "PRO";
}

export function hasUnlimitedAccounts(plan: UserPlan): boolean {
  return plan === "PRO";
}
