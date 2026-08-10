/**
 * Pure decision logic for account and organization deletion hardening.
 *
 * Extracted from the route handler (`src/app/api/account/delete/route.ts`) and
 * the admin action (`src/app/admin/organizations/actions.ts`) so the
 * hardening rules can be unit-tested without a database or Stripe.
 *
 * The helpers return a `DeleteDecision` describing what the caller should do
 * next. The caller (route/action) performs the actual DB/Stripe calls based on
 * the decision. Tests exercise these pure functions directly.
 */

export type DeleteDecision =
  | { kind: "PROCEED" }
  | { kind: "BLOCK"; status: number; error: string };

export interface AccountDeleteInput {
  /** Authenticated user id. */
  userId: string;
  role: string;
  /** Whether the user has a password set (OAuth users may not). */
  hasPassword: boolean;
  /** Whether the supplied password matches. */
  passwordValid: boolean;
  /** User-level Stripe subscription id (solo subscribers only). */
  stripeSubscriptionId: string | null;
  /** Whether Stripe checkout is configured. */
  stripeConfigured: boolean;
}

/**
 * Decide whether a self-service account deletion may proceed.
 *
 * Rules (in order):
 *  1. Password confirmation required (OAuth users without a password are
 *     blocked — they must set a password first or contact support).
 *  2. Incorrect password → 403.
 *  3. TEAM_ADMIN → must transfer admin role first (400).
 *  4. Global ADMIN → cannot self-delete (400).
 *  5. If the user has a subscription but Stripe is not configured → block (500).
 *  6. Otherwise PROCEED (the caller cancels Stripe if a subscription exists,
 *     then deletes the user).
 *
 * Note: a regular community member (USER role) with `stripeSubscriptionId =
 * null` does NOT cancel the org subscription — the org subscription stays
 * active for remaining members. Only solo subscribers have a user-level
 * subscription id.
 */
export function decideAccountDelete(input: AccountDeleteInput): DeleteDecision {
  if (!input.hasPassword) {
    return {
      kind: "BLOCK",
      status: 400,
      error: "Password confirmation is required to delete your account.",
    };
  }
  if (!input.passwordValid) {
    return { kind: "BLOCK", status: 403, error: "Incorrect password." };
  }
  if (input.role === "TEAM_ADMIN") {
    return {
      kind: "BLOCK",
      status: 400,
      error:
        "You are the team admin for your organization. Please transfer your admin role to another member before deleting your account.",
    };
  }
  if (input.role === "ADMIN") {
    return {
      kind: "BLOCK",
      status: 400,
      error: "Admin accounts cannot be self-deleted.",
    };
  }
  if (input.stripeSubscriptionId && !input.stripeConfigured) {
    return {
      kind: "BLOCK",
      status: 500,
      error:
        "Your account has an active subscription but Stripe is not configured. Please contact support to cancel your subscription before deleting your account.",
    };
  }
  return { kind: "PROCEED" };
}

export interface OrgDeleteInput {
  /** Caller role — only ADMIN (global) may delete orgs. */
  callerRole: string;
  /** Typed confirmation text. */
  confirmName: string;
  /** The organization's actual name. */
  orgName: string;
  /** Whether the org has a Stripe subscription id. */
  hasStripeSubscription: boolean;
  /** Whether Stripe checkout is configured. */
  stripeConfigured: boolean;
}

/**
 * Decide whether an organization deletion may proceed to the Stripe-cancel
 * step.
 *
 * Rules:
 *  1. Caller must be a global ADMIN (403).
 *  2. Org must exist (404 — caller checks this before calling).
 *  3. Typed confirmation must match the org name exactly (400).
 *  4. If the org has a subscription but Stripe is not configured → block (500).
 *  5. Otherwise PROCEED (the caller cancels Stripe if a subscription exists,
 *     then runs the downgrade+delete transaction).
 */
export function decideOrgDelete(input: OrgDeleteInput): DeleteDecision {
  if (input.callerRole !== "ADMIN") {
    return { kind: "BLOCK", status: 403, error: "Unauthorized" };
  }
  if (!input.confirmName || input.confirmName.trim() !== input.orgName) {
    return {
      kind: "BLOCK",
      status: 400,
      error: `Type the organization name "${input.orgName}" exactly to confirm deletion.`,
    };
  }
  if (input.hasStripeSubscription && !input.stripeConfigured) {
    return {
      kind: "BLOCK",
      status: 500,
      error:
        "This organization has an active Stripe subscription but Stripe is not configured. Cancel the subscription manually before deleting the organization.",
    };
  }
  return { kind: "PROCEED" };
}

/**
 * Decide what to do after a Stripe subscription cancel attempt fails during
 * deletion. Always BLOCK — an orphaned paid subscription is worse than a
 * retryable error. The caller surfaces the error to the admin/user.
 */
export function decideAfterStripeCancelFailure(
  scope: "account" | "org"
): { status: number; error: string } {
  return {
    status: 500,
    error:
      scope === "account"
        ? "Failed to cancel your Stripe subscription. Your account was not deleted. Retry once the subscription is canceled, or contact support."
        : "Failed to cancel the organization's Stripe subscription. The organization was not deleted. Retry once the subscription is canceled or contact support.",
  };
}
