/**
 * Humanize raw Stripe subscription status strings for admin display.
 *
 * Stripe statuses: trialing, active, past_due, canceled, unpaid,
 * incomplete, incomplete_expired, paused (rare). Anything unknown is
 * title-cased so we never show a raw snake_case string to an admin.
 */

export interface StripeStatusInfo {
  label: string;
  /** Tailwind classes for a small pill badge. */
  badgeClass: string;
  /** True when the status indicates the account needs admin attention. */
  needsAttention: boolean;
}

const STRIPE_STATUS_MAP: Record<string, StripeStatusInfo> = {
  trialing: { label: "Trial", badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20", needsAttention: true },
  active: { label: "Active", badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", needsAttention: false },
  past_due: { label: "Past due", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20", needsAttention: true },
  canceled: { label: "Canceled", badgeClass: "bg-red-500/10 text-red-400 border-red-500/20", needsAttention: false },
  unpaid: { label: "Unpaid", badgeClass: "bg-red-500/10 text-red-400 border-red-500/20", needsAttention: true },
  incomplete: { label: "Incomplete", badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/20", needsAttention: true },
  incomplete_expired: { label: "Expired", badgeClass: "bg-red-500/10 text-red-400 border-red-500/20", needsAttention: false },
  paused: { label: "Paused", badgeClass: "bg-gray-500/10 text-gray-400 border-gray-500/20", needsAttention: false },
};

const FALLBACK: StripeStatusInfo = {
  label: "Unknown",
  badgeClass: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  needsAttention: false,
};

export function humanizeStripeStatus(status: string | null | undefined): StripeStatusInfo {
  if (!status) return FALLBACK;
  return STRIPE_STATUS_MAP[status] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    badgeClass: FALLBACK.badgeClass,
    needsAttention: false,
  };
}
