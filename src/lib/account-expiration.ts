import { prisma } from "@/lib/prisma";
import type { AccountStatus, ExpirationAction, UserRole } from "@/lib/account-access";

export interface ExpirationPreviewUser {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  internalTag: string | null;
  accountStatus: AccountStatus;
  accessExpiresAt: Date | null;
  expirationAction: ExpirationAction;
  plan: string;
}

export interface ExpirationPreviewResult {
  users: ExpirationPreviewUser[];
  total: number;
  wouldDowngrade: number;
  wouldDisable: number;
}

export interface ExpirationProcessResult {
  processed: number;
  downgraded: number;
  disabled: number;
  skipped: number;
  errors: string[];
}

export async function previewExpiredAccounts(): Promise<ExpirationPreviewResult> {
  const now = new Date();

  const users = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
      accessExpiresAt: { lte: now },
      expirationAction: { not: "NONE" },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      internalTag: true,
      accountStatus: true,
      accessExpiresAt: true,
      expirationAction: true,
      plan: true,
    },
    orderBy: { accessExpiresAt: "asc" },
  });

  return {
    users: users as ExpirationPreviewUser[],
    total: users.length,
    wouldDowngrade: users.filter((u) => u.expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY").length,
    wouldDisable: users.filter((u) => u.expirationAction === "DISABLE_ACCESS").length,
  };
}

export async function processExpiredAccounts(): Promise<ExpirationProcessResult> {
  const now = new Date();
  const result: ExpirationProcessResult = {
    processed: 0,
    downgraded: 0,
    disabled: 0,
    skipped: 0,
    errors: [],
  };

  const users = await prisma.user.findMany({
    where: {
      role: { not: "ADMIN" },
      accessExpiresAt: { lte: now },
      expirationAction: { not: "NONE" },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      accountStatus: true,
      expirationAction: true,
    },
  });

  for (const user of users) {
    try {
      if (user.expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY") {
        if (user.accountStatus === "CANCELED" || user.accountStatus === "PAST_DUE") {
          result.skipped++;
          continue;
        }
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: "CALENDAR_ONLY",
            accountStatus: "EXPIRED",
            lastAccessCheckAt: now,
          },
        });
        result.downgraded++;
        result.processed++;
      } else if (user.expirationAction === "DISABLE_ACCESS") {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            accountStatus: "EXPIRED",
            lastAccessCheckAt: now,
          },
        });
        result.disabled++;
        result.processed++;
      }
    } catch (err) {
      result.errors.push(
        `Failed to process user ${user.email ?? user.id}: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }

  return result;
}

export async function processExpiredAccount(userId: string): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, accountStatus: true, accessExpiresAt: true, expirationAction: true },
  });

  if (!user) return { success: false, error: "User not found." };
  if (user.role === "ADMIN") return { success: false, error: "Cannot process ADMIN users." };

  const now = new Date();
  if (!user.accessExpiresAt || user.accessExpiresAt > now) {
    return { success: false, error: "User has not expired yet." };
  }

  if (user.expirationAction === "NONE") {
    return { success: false, error: "User has no expiration action set." };
  }

  try {
    if (user.expirationAction === "DOWNGRADE_TO_CALENDAR_ONLY") {
      if (user.accountStatus === "CANCELED" || user.accountStatus === "PAST_DUE") {
        return { success: false, error: "User is already canceled/past due — skipping downgrade." };
      }
      await prisma.user.update({
        where: { id: userId },
        data: {
          plan: "CALENDAR_ONLY",
          accountStatus: "EXPIRED",
          lastAccessCheckAt: now,
        },
      });
    } else if (user.expirationAction === "DISABLE_ACCESS") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          accountStatus: "EXPIRED",
          lastAccessCheckAt: now,
        },
      });
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
