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
 *                 Admin-assigned only for special cases. Not purchasable.
 *   PRO           — Full access: calendar + analytics + integrations (unlimited).
 *                 The only plan available for purchase.
 *
 * Account status ARCHIVED: User access expired, but data still archived.
 *                 Replaces the former LOCKED status.
 *
 * Plan inheritance: Org members inherit the org's seatPlan. When an admin
 * changes the org's seatPlan, all non-ADMIN members are updated atomically
 * in a transaction (see admin/organizations/actions.ts).
 */

export type UserPlan = "CALENDAR_ONLY" | "PRO";

export type UserRole = "USER" | "TEAM_ADMIN" | "ADMIN";

export const PLAN_LABELS: Record<UserPlan, string> = {
  CALENDAR_ONLY: "Calendar Only",
  PRO: "Pro",
};

/** Public-facing labels — hide internal tier names from users. */
export const PUBLIC_PLAN_LABELS: Record<UserPlan, string> = {
  CALENDAR_ONLY: "Calendar Access",
  PRO: "Full Access",
};

/** Admin-only labels with internal context. */
export const ADMIN_PLAN_LABELS: Record<UserPlan, string> = {
  CALENDAR_ONLY: "Calendar Only (Admin-Assigned)",
  PRO: "Pro (Full Access)",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  USER: "Client",
  TEAM_ADMIN: "Team Admin",
  ADMIN: "Admin",
};


export function isAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN";
}

export function isTeamAdmin(role: string | undefined | null): boolean {
  return role === "TEAM_ADMIN";
}

export function canAccessAnalytics(plan: UserPlan): boolean {
  return plan === "PRO";
}

export function canAccessIntegrations(plan: UserPlan): boolean {
  return plan === "PRO";
}

export function hasUnlimitedAccounts(plan: UserPlan): boolean {
  return plan === "PRO";
}
