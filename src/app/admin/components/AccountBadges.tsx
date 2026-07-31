import { format } from "date-fns";
import {
  ACCOUNT_STATUS_LABELS,
  getEffectiveAccountStatus,
  TAG_LABELS,
  type AccountStatus,
  type AccountAccessUser,
} from "@/lib/account-access";
import { humanizeStripeStatus } from "@/lib/stripe-status";
import type { UserPlan } from "@/lib/tiers";
import { ADMIN_PLAN_LABELS } from "@/lib/tiers";

const PLAN_BADGE_STYLES: Record<UserPlan, string> = {
  CALENDAR_ONLY: "bg-background-secondary text-text-muted border-border-primary",
  PRO: "bg-accent-primary/10 text-accent-primary border-[#c8952a]/30",
};

const TAG_STYLES: Record<string, string> = {
  KWLG: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  OWNER: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  BETA: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  STAFF: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  TEAM: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  OTHER: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_STYLES: Record<AccountStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  TRIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  EXPIRED: "bg-red-500/10 text-red-400 border-red-500/20",
  PAST_DUE: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/20",
  ARCHIVED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export function TagBadge({ tag }: { tag: string | null }) {
  if (!tag) return null;
  const style = TAG_STYLES[tag] ?? TAG_STYLES.OTHER;
  const label = TAG_LABELS[tag] ?? tag;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style}`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: AccountStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.ACTIVE;
  const label = ACCOUNT_STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${style}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.includes("emerald") ? "bg-emerald-400" : style.includes("red") ? "bg-red-400" : style.includes("amber") ? "bg-amber-400" : "bg-blue-400"}`} />
      {label}
    </span>
  );
}

export function CompedBadge({ isComped, reason }: { isComped: boolean; reason?: string | null }) {
  if (!isComped) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      title={reason ?? "Comped account"}
    >
      COMPED
    </span>
  );
}

/** Small plan pill — display only, no switcher. */
export function PlanBadge({ plan }: { plan: UserPlan }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${PLAN_BADGE_STYLES[plan]}`}
    >
      {ADMIN_PLAN_LABELS[plan]}
    </span>
  );
}

/**
 * Compact single-cell summary of a user's access state for the roster row.
 * Shows effective status badge (so expired users don't look "Active"),
 * plan, tag, comped dot, and a humanized Stripe sub-line when present.
 */
export interface StatusCellUser extends AccountAccessUser {
  plan: UserPlan;
  stripeStatus: string | null;
  stripeSubscriptionId: string | null;
  trialEndsAt: Date | null;
  compReason: string | null;
}

export function StatusCell({ user }: { user: StatusCellUser }) {
  const effective = getEffectiveAccountStatus(user);
  const stripe = user.stripeSubscriptionId
    ? humanizeStripeStatus(user.stripeStatus)
    : null;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1">
        <StatusBadge status={effective} />
        <PlanBadge plan={user.plan} />
        {user.internalTag && <TagBadge tag={user.internalTag} />}
        {user.isComped && <CompedBadge isComped reason={user.compReason} />}
      </div>
      {stripe && (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border w-fit ${stripe.badgeClass}`}>
          {stripe.label}
          {user.stripeStatus === "trialing" && user.trialEndsAt && (
            <span className="text-text-muted font-normal">
              · ends {format(user.trialEndsAt, "MMM d")}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
