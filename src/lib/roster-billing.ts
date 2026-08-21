export type RosterLifecycle =
  | "ACTIVE"
  | "TRIAL"
  | "CANCELING"
  | "PAST_DUE"
  | "ARCHIVED"
  | "CANCELED"
  | "PENDING";

export type RosterBillingSource = "PAID" | "COMMUNITY" | "COMPED" | "NONE";

export interface RosterBillingInput {
  accountStatus: string;
  isComped: boolean;
  organizationId: string | null;
  stripeSubscriptionId: string | null;
  stripeStatus: string | null;
  stripeCancelAt: Date | null;
  stripeCurrentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
}

export const ROSTER_LIFECYCLE_LABELS: Record<RosterLifecycle, string> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  CANCELING: "Canceling",
  PAST_DUE: "Past due",
  ARCHIVED: "Archived",
  CANCELED: "Canceled",
  PENDING: "Pending",
};

export const ROSTER_BILLING_SOURCE_LABELS: Record<RosterBillingSource, string> = {
  PAID: "Paid",
  COMMUNITY: "Community",
  COMPED: "Comped",
  NONE: "No billing",
};

export function isCancellationScheduled(
  input: Pick<RosterBillingInput, "stripeStatus" | "stripeCancelAt">,
  now = new Date()
): boolean {
  return (
    input.stripeStatus === "cancel_at_period_end" ||
    (input.stripeCancelAt !== null && input.stripeCancelAt.getTime() > now.getTime())
  );
}

export function deriveRosterLifecycle(
  input: RosterBillingInput,
  now = new Date()
): RosterLifecycle {
  if (input.accountStatus === "ARCHIVED") return "ARCHIVED";
  if (isCancellationScheduled(input, now)) return "CANCELING";
  if (input.isComped) return "ACTIVE";
  if (input.stripeStatus === "trialing" || input.accountStatus === "TRIAL") return "TRIAL";
  if (input.stripeStatus === "past_due" || input.accountStatus === "PAST_DUE") return "PAST_DUE";
  if (input.stripeStatus === "canceled" || input.accountStatus === "CANCELED") return "CANCELED";
  if (input.stripeSubscriptionId || input.accountStatus === "ACTIVE") return "ACTIVE";
  return "PENDING";
}

export function deriveRosterBillingSource(input: RosterBillingInput): RosterBillingSource {
  if (input.isComped) return "COMPED";
  if (input.organizationId) return "COMMUNITY";
  if (input.stripeSubscriptionId) return "PAID";
  return "NONE";
}

export function getRosterNextChange(
  input: RosterBillingInput,
  lifecycle: RosterLifecycle,
  now = new Date()
): { date: Date | null; label: string } {
  if (lifecycle === "TRIAL" && input.trialEndsAt) {
    return { date: input.trialEndsAt, label: "Trial ends" };
  }
  if (lifecycle === "CANCELING") {
    const date = input.stripeCancelAt ?? input.stripeCurrentPeriodEnd;
    return { date, label: "Cancels · no renewal" };
  }
  if (input.accountStatus === "EXPIRED" || lifecycle === "ARCHIVED" || lifecycle === "CANCELED") {
    return { date: null, label: "No access" };
  }
  if (input.stripeCurrentPeriodEnd && input.stripeCurrentPeriodEnd.getTime() > now.getTime()) {
    return { date: input.stripeCurrentPeriodEnd, label: "Renews" };
  }
  return { date: null, label: "No scheduled change" };
}
