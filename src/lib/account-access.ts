import type {
  AccountStatus as PrismaAccountStatus,
  ExpirationAction as PrismaExpirationAction,
  UserRole as PrismaUserRole,
  UserPlan as PrismaUserPlan,
} from "@prisma/client";

export type AccountStatus = PrismaAccountStatus;
export type ExpirationAction = PrismaExpirationAction;
export type UserRole = PrismaUserRole;
export type UserPlan = PrismaUserPlan;

export const ACCOUNT_STATUS_VALUES: AccountStatus[] = [
  "ACTIVE",
  "TRIAL",
  "COMPED",
  "EXPIRED",
  "PAST_DUE",
  "CANCELED",
  "ARCHIVED",
];

export const EXPIRATION_ACTION_VALUES: ExpirationAction[] = [
  "NONE",
  "DOWNGRADE_TO_CALENDAR_ONLY",
  "DISABLE_ACCESS",
];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  ACTIVE: "Active",
  TRIAL: "Trial",
  COMPED: "Comped",
  EXPIRED: "Expired",
  PAST_DUE: "Past Due",
  CANCELED: "Canceled",
  ARCHIVED: "Archived",
};

export const EXPIRATION_ACTION_LABELS: Record<ExpirationAction, string> = {
  NONE: "None",
  DOWNGRADE_TO_CALENDAR_ONLY: "Downgrade to Calendar Only",
  DISABLE_ACCESS: "Disable Access",
};

export const COMMON_TAGS = ["KWLG", "OWNER", "BETA", "STAFF", "TEAM", "OTHER"] as const;

export const TAG_LABELS: Record<string, string> = {
  KWLG: "KWLG",
  OWNER: "Owner",
  BETA: "Beta",
  STAFF: "Staff",
  TEAM: "Team",
  OTHER: "Other",
};

export const TAG_HELPER_TEXT: Record<string, string> = {
  KWLG: "KWLG users are usually brokerage-covered Calendar Only accounts.",
  OWNER: "Owner/internal users are usually comped with full access.",
  BETA: "Beta users are usually comped with a trial expiration date.",
  STAFF: "Staff users are internal team members.",
  TEAM: "Team users belong to an organization.",
  OTHER: "Custom tag — use for any other cohort.",
};

export interface AccountPreset {
  key: string;
  label: string;
  description: string;
  internalTag: string;
  accountStatus: AccountStatus;
  isComped: boolean;
  compReason: string;
  plan: UserPlan;
  expirationAction: ExpirationAction;
  accessExpiresAt?: Date | null;
}

export const ACCOUNT_PRESETS: AccountPreset[] = [
  {
    key: "KWLG",
    label: "KWLG Calendar Only",
    description: "Brokerage-covered KW Legacy user — Calendar Only, comped, no expiration.",
    internalTag: "KWLG",
    accountStatus: "COMPED",
    isComped: true,
    compReason: "Brokerage-covered KW Legacy user",
    plan: "CALENDAR_ONLY",
    expirationAction: "NONE",
    accessExpiresAt: null,
  },
  {
    key: "OWNER",
    label: "Owner Free Forever",
    description: "Owner / internal free-forever access — Pro plan, comped, no expiration.",
    internalTag: "OWNER",
    accountStatus: "COMPED",
    isComped: true,
    compReason: "Owner / internal free-forever access",
    plan: "PRO",
    expirationAction: "NONE",
    accessExpiresAt: null,
  },
  {
    key: "BETA",
    label: "Beta Expiring",
    description: "Beta access — comped trial with admin-chosen expiration date and action.",
    internalTag: "BETA",
    accountStatus: "TRIAL",
    isComped: true,
    compReason: "Beta access",
    plan: "PRO",
    expirationAction: "DOWNGRADE_TO_CALENDAR_ONLY",
    accessExpiresAt: null,
  },
];

export interface AccountAccessUser {
  id: string;
  role: UserRole;
  accountStatus: AccountStatus;
  accessExpiresAt: Date | null;
  expirationAction: ExpirationAction;
  isComped: boolean;
  internalTag: string | null;
}

export function isAccountExpired(user: Pick<AccountAccessUser, "accessExpiresAt">): boolean {
  if (!user.accessExpiresAt) return false;
  return user.accessExpiresAt.getTime() <= Date.now();
}

export function getEffectiveAccountStatus(user: AccountAccessUser): AccountStatus {
  if (user.role === "ADMIN") return "ACTIVE";
  if (isAccountExpired(user)) {
    if (user.expirationAction === "DISABLE_ACCESS") return "EXPIRED";
    if (user.expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY") return "ARCHIVED";
  }
  return user.accountStatus;
}

export function shouldBlockDashboardAccess(user: AccountAccessUser): boolean {
  if (user.role === "ADMIN") return false;

  if (user.accountStatus === "CANCELED" || user.accountStatus === "PAST_DUE") return true;

  if (user.accountStatus === "ARCHIVED") return true;

  if (isAccountExpired(user) && user.expirationAction === "DISABLE_ACCESS") return true;

  if (user.accountStatus === "EXPIRED" && user.expirationAction === "DISABLE_ACCESS") return true;

  return false;
}

export function shouldDowngradeToCalendarOnly(user: AccountAccessUser): boolean {
  if (user.role === "ADMIN") return false;
  if (isAccountExpired(user) && user.expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY") return true;
  return false;
}

export function getAccountBadgeLabel(user: AccountAccessUser): string {
  return ACCOUNT_STATUS_LABELS[getEffectiveAccountStatus(user)];
}

export function getAccountTagLabel(user: AccountAccessUser): string {
  if (!user.internalTag) return "—";
  return TAG_LABELS[user.internalTag] ?? user.internalTag;
}

export function normalizeTag(tag: string | null | undefined): string | null {
  if (!tag) return null;
  const trimmed = tag.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed;
}
