"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { zernio } from "@/lib/zernio";
import { generateAIInsight } from "../actions";
import { getSyncFrequencyMinutes } from "@/lib/platform-config";
import { normalizeBestTimeResponse } from "@/lib/best-time";
import { normalizeFollowerStatsResponse } from "@/lib/follower-stats";

export async function disconnectZernioAccount(platform: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const account = await prisma.zernioAccount.findUnique({
    where: { userId_platform: { userId: session.user.id, platform } },
  });

  if (account) {
    try {
      await zernio.accounts.delete(account.zernioAccountId);
    } catch {
      // Continue even if Zernio-side deletion fails
    }
    await prisma.zernioAccount.delete({
      where: { userId_platform: { userId: session.user.id, platform } },
    });
  }

  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

async function syncSingleAccount(
  userId: string,
  account: { zernioAccountId: string; platform: string },
  startStr: string,
  endStr: string
): Promise<number> {
  let synced = 0;

  try {
    const analytics = await zernio.analytics.getForAccount(
      account.zernioAccountId,
      startStr,
      endStr
    );

    for (const post of analytics.posts ?? []) {
      const m = post.analytics;
      const viewCount = Math.max(m.impressions ?? 0, m.views ?? 0);
      await prisma.postAnalytics.upsert({
        where: { externalId_userId: { externalId: post._id, userId } },
        update: {
          views: viewCount,
          likes: m.likes ?? 0,
          comments: m.comments ?? 0,
          postUrl: post.platformPostUrl ?? null,
        },
        create: {
          userId,
          externalId: post._id,
          title: post.content.slice(0, 120),
          format: (post.platform ?? account.platform).toUpperCase(),
          publishedAt: new Date(post.publishedAt),
          views: viewCount,
          likes: m.likes ?? 0,
          comments: m.comments ?? 0,
          postUrl: post.platformPostUrl ?? null,
        },
      });
      synced++;
    }
  } catch (err) {
    console.error(`Failed to sync analytics for ${account.platform}:`, err);
  }

  // Fetch & store best posting times for this platform
  try {
    const rawBestTime = await zernio.analytics.getBestTime(account.zernioAccountId);
    const heatmapData = normalizeBestTimeResponse(rawBestTime);
    const hasData = heatmapData.bestSlots.length > 0;
    if (hasData) {
      await prisma.bestTimeToPost.upsert({
        where: { userId_platform: { userId, platform: account.platform } },
        update: { heatmap: heatmapData as unknown as Prisma.InputJsonValue },
        create: {
          userId,
          platform: account.platform,
          heatmap: heatmapData as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to fetch best-time for ${account.platform}:`, err);
  }

  // Fetch & store follower stats for this platform
  try {
    const rawFollowerStats = await zernio.analytics.getFollowerStats(account.zernioAccountId);
    const { points } = normalizeFollowerStatsResponse(rawFollowerStats, account.zernioAccountId);
    for (const point of points) {
      const dateObj = new Date(point.date + "T00:00:00Z");
      await prisma.followerStats.upsert({
        where: {
          userId_platform_date: {
            userId,
            platform: account.platform,
            date: dateObj,
          },
        },
        update: {
          followerCount: point.followerCount,
          growthDelta: point.growthDelta,
          growthPercent: point.growthPercent,
        },
        create: {
          userId,
          platform: account.platform,
          date: dateObj,
          followerCount: point.followerCount,
          growthDelta: point.growthDelta,
          growthPercent: point.growthPercent,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to fetch follower-stats for ${account.platform}:`, err);
  }

  return synced;
}

export async function syncAnalytics() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId: session.user.id },
  });

  if (zernioAccounts.length === 0) {
    return { success: false, message: "No connected accounts" };
  }

  const syncFreqMinutes = await getSyncFrequencyMinutes();
  const now = new Date();
  const minSyncTime = new Date(now.getTime() - syncFreqMinutes * 60 * 1000);

  const recentSync = zernioAccounts.some(
    (a) => a.lastSyncAt && a.lastSyncAt > minSyncTime
  );

  if (recentSync) {
    const oldestSync = zernioAccounts
      .filter((a) => a.lastSyncAt)
      .sort((a, b) => (a.lastSyncAt!.getTime() - b.lastSyncAt!.getTime()))[0];
    const nextAvailable = new Date(
      (oldestSync?.lastSyncAt ?? now).getTime() + syncFreqMinutes * 60 * 1000
    );
    return {
      success: false,
      message: `Sync throttled. Try again after ${nextAvailable.toLocaleTimeString()}.`,
    };
  }

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  let synced = 0;

  for (const account of zernioAccounts) {
    synced += await syncSingleAccount(session.user.id, account, startStr, endStr);
  }

  // Regenerate AI insight with fresh data (cheap Haiku call)
  if (synced > 0) {
    // Update lastSyncAt for all user's accounts
    await prisma.zernioAccount.updateMany({
      where: { userId: session.user.id },
      data: { lastSyncAt: now },
    });

    generateAIInsight(session.user.id).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );
  }

  revalidatePath("/dashboard");
  return { success: true, synced };
}

export async function autoSyncAnalyticsIfNeeded() {
  const session = await auth();
  if (!session?.user?.id) return;

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId: session.user.id },
  });

  if (zernioAccounts.length === 0) return;

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - AUTO_SYNC_INTERVAL_MS);

  // Only sync accounts that haven't been synced in 24h (or never synced)
  const staleAccounts = zernioAccounts.filter(
    (a) => !a.lastSyncAt || a.lastSyncAt < staleThreshold
  );

  if (staleAccounts.length === 0) return;

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  let synced = 0;

  for (const account of staleAccounts) {
    synced += await syncSingleAccount(session.user.id, account, startStr, endStr);
    // Update lastSyncAt per account so each account gets its own 24h clock
    await prisma.zernioAccount.update({
      where: { userId_platform: { userId: session.user.id, platform: account.platform } },
      data: { lastSyncAt: now },
    });
  }

  if (synced > 0) {
    generateAIInsight(session.user.id).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );
    revalidatePath("/dashboard");
  }
}
