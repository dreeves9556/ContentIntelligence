"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { zernio } from "@/lib/zernio";
import { generateAIInsight } from "../actions";
import { normalizeBestTimeResponse } from "@/lib/best-time";
import { normalizeFollowerStatsResponse } from "@/lib/follower-stats";
import { PLATFORM_DEEP_ANALYTICS, normalizeContentDecay, normalizeDailyMetrics, normalizePostingFrequency } from "@/lib/deep-analytics";
import { runLearningPipeline } from "@/lib/memory/memory-builder";
import { checkActionRateLimit, formatRetryTime } from "@/lib/rate-limiter";
import { checkAndSendAnalyticsMilestone } from "@/lib/notifications";
import { ensureBaselineForUserPlatform } from "@/lib/impact-baselines";
import { requireDashboardAccess } from "@/lib/server-access";

export async function disconnectZernioAccount(platform: string) {
  const access = await requireDashboardAccess({ requiredPlan: "PRO" });
  if (!access.allowed) throw new Error(access.error);
  const userId = access.user.id;

  const account = await prisma.zernioAccount.findUnique({
    where: { userId_platform: { userId, platform } },
  });

  if (account) {
    try {
      await zernio.accounts.delete(account.zernioAccountId);
    } catch {
      // Continue even if Zernio-side deletion fails
    }
    await prisma.zernioAccount.delete({
      where: { userId_platform: { userId, platform } },
    });
  }

  revalidatePath("/dashboard/integrations");
  revalidatePath("/dashboard/calendar");
  return { success: true };
}

const AUTO_SYNC_INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

interface AccountSyncResult {
  syncedPosts: number;
  analyticsSucceeded: boolean;
  followerStatsSucceeded: boolean;
}

async function syncSingleAccount(
  userId: string,
  account: { zernioAccountId: string; platform: string; zernioProfileId: string },
  startStr: string,
  endStr: string
): Promise<AccountSyncResult> {
  let synced = 0;
  let analyticsSucceeded = false;
  let followerStatsSucceeded = false;

  try {
    const analytics = await zernio.analytics.getForAccount(
      account.zernioAccountId,
      startStr,
      endStr
    );

    for (const post of analytics.posts ?? []) {
      const m = post.analytics;
      // Prefer an actual view count. Some platforms only expose impressions,
      // which remains the documented fallback rather than being mixed via max().
      const viewCount = m.views ?? m.impressions ?? 0;
      await prisma.postAnalytics.upsert({
        where: { externalId_userId: { externalId: post._id, userId } },
        update: {
          views: viewCount,
          likes: m.likes ?? 0,
          comments: m.comments ?? 0,
          postUrl: post.platformPostUrl ?? null,
          platform: account.platform.toLowerCase(),
          isDemo: false,
          title: post.content.slice(0, 120),
          publishedAt: new Date(post.publishedAt),
        },
        create: {
          userId,
          externalId: post._id,
          title: post.content.slice(0, 120),
          format: (post.platform ?? account.platform).toUpperCase(),
          platform: account.platform.toLowerCase(),
          isDemo: false,
          publishedAt: new Date(post.publishedAt),
          views: viewCount,
          likes: m.likes ?? 0,
          comments: m.comments ?? 0,
          postUrl: post.platformPostUrl ?? null,
        },
      });
      synced++;
    }
    analyticsSucceeded = true;
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
    followerStatsSucceeded = points.length > 0;
  } catch (err) {
    console.error(`Failed to fetch follower-stats for ${account.platform}:`, err);
  }

  // Fetch & store platform-specific deep analytics
  const deepConfigs = PLATFORM_DEEP_ANALYTICS[account.platform.toLowerCase()];
  if (deepConfigs) {
    for (const cfg of deepConfigs) {
      try {
        const rawDeep = cfg.useAccountPath
          ? await zernio.analytics.getAccountAnalytics(account.zernioAccountId, cfg.endpoint)
          : await zernio.analytics.getDeepAnalytics(account.zernioAccountId, cfg.endpoint);
        const normalized = cfg.normalize(rawDeep);
        await prisma.deepAnalytics.upsert({
          where: {
            userId_platform_dataType: {
              userId,
              platform: account.platform,
              dataType: cfg.dataType,
            },
          },
          update: {
            data: normalized as unknown as Prisma.InputJsonValue,
          },
          create: {
            userId,
            platform: account.platform,
            dataType: cfg.dataType,
            data: normalized as unknown as Prisma.InputJsonValue,
          },
        });
      } catch (err) {
        console.error(`Failed to fetch deep analytics ${cfg.endpoint} for ${account.platform}:`, err);
      }
    }
  }

  // Fetch & store per-platform content decay
  try {
    const rawDecay = await zernio.analytics.getProfileAnalytics(
      account.zernioProfileId,
      "content-decay",
      { platform: account.platform.toLowerCase() }
    );
    const normalized = normalizeContentDecay(rawDecay);
    if (normalized.buckets.length > 0) {
      const wrapped = { kind: "contentDecay" as const, payload: normalized };
      await prisma.deepAnalytics.upsert({
        where: {
          userId_platform_dataType: {
            userId,
            platform: account.platform,
            dataType: "content_decay",
          },
        },
        update: { data: wrapped as unknown as Prisma.InputJsonValue },
        create: {
          userId,
          platform: account.platform,
          dataType: "content_decay",
          data: wrapped as unknown as Prisma.InputJsonValue,
        },
      });
    }
  } catch (err) {
    console.error(`Failed to fetch content-decay for ${account.platform}:`, err);
  }

  ensureBaselineForUserPlatform(userId, account.platform).catch((err) => {
    console.error(`[impact] baseline creation failed for ${userId}/${account.platform}:`, err);
  });

  return { syncedPosts: synced, analyticsSucceeded, followerStatsSucceeded };
}

export async function syncAnalytics() {
  const access = await requireDashboardAccess({ requiredPlan: "PRO" });
  if (!access.allowed) throw new Error(access.error);
  const userId = access.user.id;

  const rateLimit = await checkActionRateLimit(
    `analytics_sync:${userId}`,
    10,
    60 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return { success: false, message: `Too many sync requests. Please try again in ${formatRetryTime(rateLimit.retryAfterMs ?? 0)}.` };
  }

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId },
  });

  if (zernioAccounts.length === 0) {
    return { success: false, message: "No connected accounts" };
  }

  const now = new Date();

  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  let synced = 0;

  for (const account of zernioAccounts) {
    const result = await syncSingleAccount(userId, account, startStr, endStr);
    synced += result.syncedPosts;
    if (result.analyticsSucceeded && result.followerStatsSucceeded) {
      await prisma.zernioAccount.update({
        where: { userId_platform: { userId, platform: account.platform } },
        data: { lastSyncAt: now },
      });
    }
  }

  // Sync profile-level deep analytics (content-decay, daily-metrics, posting-frequency)
  const profileId = zernioAccounts[0].zernioProfileId;
  const profileEndpoints: { endpoint: "content-decay" | "daily-metrics" | "posting-frequency"; dataType: string; normalize: (raw: unknown) => { kind: string; payload: unknown } }[] = [
    { endpoint: "content-decay", dataType: "content_decay", normalize: (r) => ({ kind: "contentDecay", payload: normalizeContentDecay(r) }) },
    { endpoint: "daily-metrics", dataType: "daily_metrics", normalize: (r) => ({ kind: "dailyMetrics", payload: normalizeDailyMetrics(r) }) },
    { endpoint: "posting-frequency", dataType: "posting_frequency", normalize: (r) => ({ kind: "postingFrequency", payload: normalizePostingFrequency(r) }) },
  ];
  for (const cfg of profileEndpoints) {
    try {
      const raw = await zernio.analytics.getProfileAnalytics(profileId, cfg.endpoint);
      const normalized = cfg.normalize(raw);
      await prisma.deepAnalytics.upsert({
        where: {
          userId_platform_dataType: {
            userId,
            platform: "ALL",
            dataType: cfg.dataType,
          },
        },
        update: { data: normalized as unknown as Prisma.InputJsonValue },
        create: {
          userId,
          platform: "ALL",
          dataType: cfg.dataType,
          data: normalized as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      console.error(`Failed to fetch profile analytics ${cfg.endpoint}:`, err);
    }
  }

  // Regenerate AI insight with fresh data (cheap Haiku call)
  if (synced > 0) {
    // Run memory learning pipeline — may create new PERFORMANCE/AUDIENCE memories from fresh analytics
    runLearningPipeline(userId).catch((err) =>
      console.error("Memory learning pipeline failed:", err)
    );

    generateAIInsight(userId).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );

    // Check analytics milestones for recently synced posts (background, non-blocking)
    (async () => {
      const recentPosts = await prisma.postAnalytics.findMany({
        where: { userId },
        orderBy: { publishedAt: "desc" },
        take: 10,
        select: { title: true, views: true, format: true },
      });
      for (const post of recentPosts) {
        checkAndSendAnalyticsMilestone(
          userId,
          post.title,
          post.views,
          post.format
        ).catch((err) => console.error("[MILESTONE] Check failed:", err));
      }
    })().catch((err) => console.error("[MILESTONE] Batch failed:", err));
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/analytics");
  return { success: true, synced };
}

export async function autoSyncAnalyticsIfNeeded() {
  const access = await requireDashboardAccess({ requiredPlan: "PRO" });
  if (!access.allowed) return;
  const userId = access.user.id;

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId },
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
    const result = await syncSingleAccount(userId, account, startStr, endStr);
    synced += result.syncedPosts;
    if (result.analyticsSucceeded && result.followerStatsSucceeded) {
      await prisma.zernioAccount.update({
        where: { userId_platform: { userId, platform: account.platform } },
        data: { lastSyncAt: now },
      });
    }
  }

  if (synced > 0) {
    generateAIInsight(userId).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/analytics");
  }
}
