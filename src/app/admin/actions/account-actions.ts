"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  ACCOUNT_STATUS_VALUES,
  EXPIRATION_ACTION_VALUES,
  ACCOUNT_PRESETS,
  normalizeTag,
  type AccountStatus,
  type ExpirationAction,
  type UserPlan,
  type UserRole,
} from "@/lib/account-access";
import {
  previewExpiredAccounts,
  processExpiredAccounts,
  processExpiredAccount,
  type ExpirationPreviewResult,
  type ExpirationProcessResult,
} from "@/lib/account-expiration";
import { sendAccountStatusChangedEmail } from "@/lib/account-emails";

const VALID_PLANS: UserPlan[] = ["CALENDAR_ONLY", "PRO"];
const VALID_ROLES: UserRole[] = ["USER", "TEAM_ADMIN", "ADMIN"];

export interface UpdateUserAccountInput {
  plan?: UserPlan;
  role?: UserRole;
  accountStatus?: AccountStatus;
  internalTag?: string | null;
  isComped?: boolean;
  compReason?: string | null;
  accessExpiresAt?: Date | null;
  expirationAction?: ExpirationAction;
}

export async function updateUserAccount(
  userId: string,
  data: UpdateUserAccountInput
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, organizationId: true, accountStatus: true },
  });

  if (!targetUser) {
    return { success: false, error: "User not found." };
  }

  const updateData: Record<string, unknown> = {};

  if (data.plan !== undefined) {
    if (!VALID_PLANS.includes(data.plan)) {
      return { success: false, error: "Invalid plan." };
    }
    updateData.plan = data.plan;
  }

  if (data.role !== undefined) {
    if (!VALID_ROLES.includes(data.role)) {
      return { success: false, error: "Invalid role." };
    }

    if (data.role === "TEAM_ADMIN" && !targetUser.organizationId) {
      return {
        success: false,
        error: "User must be assigned to an organization before being promoted to Team Admin.",
      };
    }

    if (data.role === "ADMIN") {
      updateData.role = "ADMIN";
      updateData.organizationId = null;
      updateData.accessExpiresAt = null;
      updateData.expirationAction = "NONE";
    } else {
      updateData.role = data.role;
    }
  }

  if (data.accountStatus !== undefined) {
    if (!ACCOUNT_STATUS_VALUES.includes(data.accountStatus)) {
      return { success: false, error: "Invalid account status." };
    }
    updateData.accountStatus = data.accountStatus;
  }

  if (data.internalTag !== undefined) {
    updateData.internalTag = normalizeTag(data.internalTag);
  }

  if (data.isComped !== undefined) {
    updateData.isComped = data.isComped;
  }

  if (data.compReason !== undefined) {
    updateData.compReason = data.compReason || null;
  }

  if (data.accessExpiresAt !== undefined) {
    updateData.accessExpiresAt = data.accessExpiresAt;
  }

  if (data.expirationAction !== undefined) {
    if (!EXPIRATION_ACTION_VALUES.includes(data.expirationAction)) {
      return { success: false, error: "Invalid expiration action." };
    }
    updateData.expirationAction = data.expirationAction;
  }

  try {
    const oldStatus = targetUser.accountStatus;
    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (data.accountStatus && data.accountStatus !== oldStatus) {
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true },
      });
      if (updatedUser?.email) {
        sendAccountStatusChangedEmail({ id: userId, ...updatedUser }, oldStatus, data.accountStatus).catch(() => {});
      }
    }

    return { success: true };
  } catch (err) {
    console.error("[ACCOUNT ACTIONS] updateUserAccount error:", err);
    return { success: false, error: "Failed to update account." };
  }
}

export async function applyAccountPreset(
  userId: string,
  presetKey: string,
  options?: { accessExpiresAt?: Date | null; expirationAction?: ExpirationAction }
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const preset = ACCOUNT_PRESETS.find((p) => p.key === presetKey);
  if (!preset) {
    return { success: false, error: "Invalid preset." };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        internalTag: preset.internalTag,
        accountStatus: preset.accountStatus,
        isComped: preset.isComped,
        compReason: preset.compReason,
        plan: preset.plan,
        expirationAction: options?.expirationAction ?? preset.expirationAction,
        accessExpiresAt: options?.accessExpiresAt !== undefined ? options.accessExpiresAt : preset.accessExpiresAt ?? null,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[ACCOUNT ACTIONS] applyAccountPreset error:", err);
    return { success: false, error: "Failed to apply preset." };
  }
}

export interface BulkUpdateInput {
  internalTag?: string | null;
  accountStatus?: AccountStatus;
  isComped?: boolean;
  compReason?: string | null;
  accessExpiresAt?: Date | null;
  expirationAction?: ExpirationAction;
  plan?: UserPlan;
}

export interface BulkUpdateResult {
  success: boolean;
  processed: number;
  skipped: number;
  errors: string[];
}

export async function bulkUpdateAccounts(
  userIds: string[],
  data: BulkUpdateInput,
  allowAdminOverride?: boolean
): Promise<BulkUpdateResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, processed: 0, skipped: 0, errors: ["Unauthorized"] };
  }

  if (!userIds.length) {
    return { success: false, processed: 0, skipped: 0, errors: ["No users selected."] };
  }

  if (data.accountStatus && !ACCOUNT_STATUS_VALUES.includes(data.accountStatus)) {
    return { success: false, processed: 0, skipped: 0, errors: ["Invalid account status."] };
  }

  if (data.expirationAction && !EXPIRATION_ACTION_VALUES.includes(data.expirationAction)) {
    return { success: false, processed: 0, skipped: 0, errors: ["Invalid expiration action."] };
  }

  if (data.plan && !VALID_PLANS.includes(data.plan)) {
    return { success: false, processed: 0, skipped: 0, errors: ["Invalid plan."] };
  }

  const updateData: Record<string, unknown> = {};
  if (data.internalTag !== undefined) updateData.internalTag = normalizeTag(data.internalTag);
  if (data.accountStatus !== undefined) updateData.accountStatus = data.accountStatus;
  if (data.isComped !== undefined) updateData.isComped = data.isComped;
  if (data.compReason !== undefined) updateData.compReason = data.compReason || null;
  if (data.accessExpiresAt !== undefined) updateData.accessExpiresAt = data.accessExpiresAt;
  if (data.expirationAction !== undefined) updateData.expirationAction = data.expirationAction;
  if (data.plan !== undefined) updateData.plan = data.plan;

  if (Object.keys(updateData).length === 0) {
    return { success: false, processed: 0, skipped: 0, errors: ["No fields to update."] };
  }

  const result: BulkUpdateResult = {
    success: true,
    processed: 0,
    skipped: 0,
    errors: [],
  };

  for (const userId of userIds) {
    try {
      const target = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!target) {
        result.errors.push(`User ${userId} not found.`);
        continue;
      }

      if (target.role === "ADMIN" && !allowAdminOverride) {
        result.skipped++;
        continue;
      }

      await prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
      result.processed++;
    } catch (err) {
      result.errors.push(`Failed to update user ${userId}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return result;
}

export async function adminPreviewExpirations(): Promise<{ data?: ExpirationPreviewResult; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const data = await previewExpiredAccounts();
    return { data };
  } catch (err) {
    console.error("[ACCOUNT ACTIONS] previewExpirations error:", err);
    return { error: "Failed to preview expirations." };
  }
}

export async function adminProcessExpirations(): Promise<{ data?: ExpirationProcessResult; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  try {
    const data = await processExpiredAccounts();
    return { data };
  } catch (err) {
    console.error("[ACCOUNT ACTIONS] processExpirations error:", err);
    return { error: "Failed to process expirations." };
  }
}

export async function adminProcessSingleExpiration(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  return processExpiredAccount(userId);
}
