import { format } from "date-fns";
import {
  ACCOUNT_STATUS_LABELS,
  TAG_LABELS,
  type AccountStatus,
  type AccountAccessUser,
} from "@/lib/account-access";
import {
  deriveRosterBillingSource,
  deriveRosterLifecycle,
  getRosterNextChange,
  ROSTER_BILLING_SOURCE_LABELS,
  ROSTER_LIFECYCLE_LABELS,
  type RosterBillingInput,
  type RosterBillingSource,
  type RosterLifecycle,
} from "@/lib/roster-billing";
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

const LIFECYCLE_STYLES: Record<RosterLifecycle, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  TRIAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  CANCELING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PAST_DUE: "bg-red-500/10 text-red-400 border-red-500/20",
  ARCHIVED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  CANCELED: "bg-red-500/10 text-red-400 border-red-500/20",
  PENDING: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const BILLING_SOURCE_STYLES: Record<RosterBillingSource, string> = {
  PAID: "bg-accent-primary/10 text-accent-primary border-accent-primary/20",
  COMMUNITY: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  COMPED: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  NONE: "bg-gray-500/10 text-gray-400 border-gray-500/20",
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

export function RosterLifecycleBadge({ lifecycle }: { lifecycle: RosterLifecycle }) {
  const style = LIFECYCLE_STYLES[lifecycle];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium border ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.includes("emerald") ? "bg-emerald-400" : style.includes("blue") ? "bg-blue-400" : style.includes("amber") ? "bg-amber-400" : style.includes("red") ? "bg-red-400" : "bg-gray-400"}`} />
      {ROSTER_LIFECYCLE_LABELS[lifecycle]}
    </span>
  );
}

export function BillingSourceBadge({ source }: { source: RosterBillingSource }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${BILLING_SOURCE_STYLES[source]}`}>
      {ROSTER_BILLING_SOURCE_LABELS[source]}
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

/** Compact lifecycle, billing-source, and next-change summary for a roster row. */
export interface StatusCellUser extends AccountAccessUser {
  plan: UserPlan;
  organizationId: string | null;
  stripeStatus: string | null;
  stripeSubscriptionId: string | null;
  billingStatus: string | null;
  billingSubscriptionId: string | null;
  billingCancelAt: Date | null;
  billingCurrentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  compReason: string | null;
}

export function StatusCell({ user }: { user: StatusCellUser }) {
  const billingInput: RosterBillingInput = {
    accountStatus: user.accountStatus,
    isComped: user.isComped,
    organizationId: user.organizationId,
    stripeSubscriptionId: user.billingSubscriptionId,
    stripeStatus: user.billingStatus,
    stripeCancelAt: user.billingCancelAt,
    stripeCurrentPeriodEnd: user.billingCurrentPeriodEnd,
    trialEndsAt: user.trialEndsAt,
  };
  const lifecycle = deriveRosterLifecycle(billingInput);
  const source = deriveRosterBillingSource(billingInput);
  const nextChange = getRosterNextChange(billingInput, lifecycle);

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex flex-wrap items-center gap-1">
        <RosterLifecycleBadge lifecycle={lifecycle} />
        <BillingSourceBadge source={source} />
        <PlanBadge plan={user.plan} />
        {user.internalTag && <TagBadge tag={user.internalTag} />}
      </div>
      <span className={`text-xs ${lifecycle === "CANCELING" ? "text-amber-400" : "text-text-muted"}`}>
        {nextChange.date
          ? `${nextChange.label} ${format(nextChange.date, "MMM d, yyyy")}`
          : nextChange.label}
      </span>
    </div>
  );
}
