/**
 * Trial configuration & helpers.
 *
 * Both Solo and Community memberships get a 7-day card-upfront trial.
 * One trial per person — `hasUsedTrial` on User prevents repeat trials.
 */

export const TRIAL_PERIOD_DAYS = 7;

/**
 * Build the `subscription_data` trial config for Stripe Checkout.
 * Returns an empty object when no trial should be granted, so the caller
 * can spread it unconditionally.
 */
export function buildTrialSubscriptionData(eligible: boolean): {
  trial_period_days?: number;
  trial_settings?: {
    end_behavior: {
      missing_payment_method: "cancel" | "pause";
    };
  };
} {
  if (!eligible) return {};
  return {
    trial_period_days: TRIAL_PERIOD_DAYS,
    trial_settings: {
      end_behavior: {
        missing_payment_method: "cancel",
      },
    },
  };
}

/**
 * Determine whether a user is eligible for a free trial.
 * Eligible if: never used a trial, has no existing subscription, and is not comped.
 */
export function isTrialEligible(user: {
  hasUsedTrial: boolean;
  stripeSubscriptionId: string | null;
  isComped: boolean;
  role: string;
}): boolean {
  return (
    !user.hasUsedTrial &&
    !user.stripeSubscriptionId &&
    !user.isComped &&
    user.role !== "ADMIN"
  );
}

/**
 * Calculate whole days remaining in a trial.
 * Returns 0 if trialEndsAt is null or in the past.
 */
export function trialDaysRemaining(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0;
  const ms = trialEndsAt.getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}
