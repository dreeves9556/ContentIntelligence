import {
  ACCOUNT_STATUS_LABELS,
  TAG_LABELS,
  type AccountStatus,
} from "@/lib/account-access";

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
