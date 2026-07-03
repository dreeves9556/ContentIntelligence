"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { PlatformConfigData } from "@/lib/platform-config";
import { encryptIfPlaintext, decryptIfEncrypted } from "@/lib/crypto";

export async function updatePlatformConfig(
  data: Partial<PlatformConfigData>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };
  if (session.user.role !== "ADMIN") return { success: false, error: "Not authorized" };

  const allowed: (keyof PlatformConfigData)[] = [
    "zernioApiKey",
    "zernioEnabledPlatforms",
    "analyticsSyncFrequencyMinutes",
    "anthropicModel",
    "anthropicApiKey",
  ];

  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in data) {
      update[key] = data[key];
    }
  }

  // Encrypt API keys before storing
  if (update.zernioApiKey !== undefined) {
    update.zernioApiKey = update.zernioApiKey ? encryptIfPlaintext(update.zernioApiKey as string) : null;
  }
  if (update.anthropicApiKey !== undefined) {
    update.anthropicApiKey = update.anthropicApiKey ? encryptIfPlaintext(update.anthropicApiKey as string) : null;
  }

  if (
    typeof update.analyticsSyncFrequencyMinutes === "string"
  ) {
    const parsed = parseInt(update.analyticsSyncFrequencyMinutes, 10);
    if (isNaN(parsed) || parsed < 1) {
      return { success: false, error: "Sync frequency must be a positive number" };
    }
    update.analyticsSyncFrequencyMinutes = parsed;
  }

  if (Array.isArray(update.zernioEnabledPlatforms)) {
    if (update.zernioEnabledPlatforms.length === 0) {
      return { success: false, error: "At least one platform must be enabled" };
    }
  }

  try {
    await prisma.platformConfig.upsert({
      where: { id: "default" },
      update,
      create: {
        id: "default",
        ...update,
      },
    });
  } catch (err) {
    console.error("Failed to update platform config:", err);
    return { success: false, error: "Failed to save settings" };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/dashboard/integrations");
  return { success: true };
}

export async function getPlatformConfigForAdmin(): Promise<PlatformConfigData & { _count?: { zernioAccounts: number } }> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  const row = await prisma.platformConfig.findUnique({
    where: { id: "default" },
  });

  if (!row) {
    const count = await prisma.zernioAccount.count();
    return {
      zernioApiKey: null,
      zernioEnabledPlatforms: ["instagram", "tiktok", "facebook", "youtube"],
      analyticsSyncFrequencyMinutes: 60,
      anthropicModel: "claude-opus-4-8",
      anthropicApiKey: null,
      insightPromptTemplate: null,
      calendarPromptTemplate: null,
      calendarStrategyPromptTemplate: null,
      _count: { zernioAccounts: count },
    };
  }

  const count = await prisma.zernioAccount.count();
  return {
    zernioApiKey: decryptIfEncrypted(row.zernioApiKey),
    zernioEnabledPlatforms: row.zernioEnabledPlatforms,
    analyticsSyncFrequencyMinutes: row.analyticsSyncFrequencyMinutes,
    anthropicModel: row.anthropicModel,
    anthropicApiKey: decryptIfEncrypted(row.anthropicApiKey),
    insightPromptTemplate: row.insightPromptTemplate,
    calendarPromptTemplate: row.calendarPromptTemplate,
    calendarStrategyPromptTemplate: row.calendarStrategyPromptTemplate,
    _count: { zernioAccounts: count },
  };
}
