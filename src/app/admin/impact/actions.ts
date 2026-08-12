"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicApiKey, getAnthropicModel } from "@/lib/platform-config";
import { revalidatePath } from "next/cache";
import {
  IMPACT_DEFINITION_VERSION,
  impactSourceFingerprint,
  type ImpactScopeMetadata,
} from "@/lib/impact-contract";
import {
  getImpactOverview,
  getImpactTimeSeries,
  getEngagementTimeSeries,
  getMemberGrowthRows,
  getPlatformGrowthBreakdown,
  getCohortGrowthBreakdown,
  getUsageCorrelationStats,
  getDataQualityStats,
  type ImpactOverview,
  type ImpactTimeSeriesPoint,
  type EngagementTimeSeriesPoint,
  type MemberGrowthRow,
  type PlatformGrowthBreakdownRow,
  type CohortGrowthRow,
  type UsageCorrelationStats,
  type DataQualityStats,
} from "@/lib/impact-analytics";
import {
  ensureMemberGrowthBaselines,
  recalculateEngagementBaselines,
} from "@/lib/impact-baselines";
import { computeWeightedEngagementRate, utcStartOfDay } from "@/lib/impact-math";

export interface ImpactData {
  metadata: ImpactScopeMetadata;
  overview: ImpactOverview;
  timeSeries: ImpactTimeSeriesPoint[];
  engagementTimeSeries: EngagementTimeSeriesPoint[];
  memberRows: MemberGrowthRow[];
  platformBreakdown: PlatformGrowthBreakdownRow[];
  cohortBreakdown: CohortGrowthRow[];
  usageCorrelation: UsageCorrelationStats;
  dataQuality: DataQualityStats;
}

export async function getImpactData(): Promise<ImpactData | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }
  return loadImpactData();
}

async function loadImpactData(): Promise<ImpactData> {
  const [overview, timeSeries, engagementTimeSeries, memberRows, dataQuality] =
    await Promise.all([
    getImpactOverview(),
    getImpactTimeSeries(),
    getEngagementTimeSeries(),
    getMemberGrowthRows(),
    getDataQualityStats(),
  ]);
  const [platformBreakdown, cohortBreakdown, usageCorrelation] =
    await Promise.all([
      getPlatformGrowthBreakdown(memberRows),
      getCohortGrowthBreakdown(memberRows),
      getUsageCorrelationStats(memberRows),
    ]);

  const syncTimes = memberRows
    .map((row) => row.lastSyncAt)
    .filter((value): value is string => value != null)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  const dataThroughAt =
    memberRows.length > 0 && syncTimes.length === memberRows.length
      ? new Date(Math.min(...syncTimes)).toISOString()
      : null;
  const metadata: ImpactScopeMetadata = {
    definitionVersion: IMPACT_DEFINITION_VERSION,
    generatedAt: new Date().toISOString(),
    dataThroughAt,
    scopeLabel: "Since connection",
    eligibleUsers: dataQuality.totalUsers,
    eligibleAccounts: dataQuality.totalAccounts,
    validFollowerAccounts: overview.accountsWithValidBaseline,
    validEngagementAccounts: overview.accountsWithValidEngagement,
    accountsWithoutBaselines: dataQuality.accountsWithoutBaselines,
    accountsWithoutRecentSync: dataQuality.accountsWithoutRecentSync,
    accountsWithoutPostAnalytics: dataQuality.accountsWithoutPostAnalytics,
    suspiciousFollowerAccounts: dataQuality.suspiciousFollowerAccounts,
    sourceFingerprint: impactSourceFingerprint({
      overview,
      timeSeries,
      engagementTimeSeries,
      platformBreakdown,
      cohortBreakdown,
      usageCorrelation,
      dataQuality,
    }),
  };

  return {
    metadata,
    overview,
    timeSeries,
    engagementTimeSeries,
    memberRows,
    platformBreakdown,
    cohortBreakdown,
    usageCorrelation,
    dataQuality,
  };
}

export async function backfillBaselines(): Promise<{
  success: boolean;
  created?: number;
  skipped?: number;
  missingFollowerStats?: number;
  errors?: string[];
  error?: string;
}> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await ensureMemberGrowthBaselines();
    return {
      success: true,
      created: result.created,
      skipped: result.skipped,
      missingFollowerStats: result.missingFollowerStats,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to backfill baselines",
    };
  }
}

export async function recalculateEngagementBaselinesAction(): Promise<{
  success: boolean;
  updated?: number;
  skipped?: number;
  errors?: string[];
  error?: string;
}> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const result = await recalculateEngagementBaselines();
    return {
      success: true,
      updated: result.updated,
      skipped: result.skipped,
      errors: result.errors,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to recalculate engagement baselines",
    };
  }
}

interface BaselinePreviewItem {
  userId: string;
  platform: string;
  connectionPeriodId: string | null;
  oldBaselineDate: string | null;
  oldFollowerCount: number | null;
  proposedDate: string | null;
  proposedFollowerCount: number | null;
  proposedEngagementRate: number | null;
  status: "READY" | "NO_DATA";
  reason: string;
}

export interface BaselinePreviewResult {
  success: boolean;
  runId?: string;
  status?: string;
  items?: BaselinePreviewItem[];
  applied?: number;
  skipped?: number;
  error?: string;
}

const IMPACT_ELIGIBLE_STATUSES = ["ACTIVE", "TRIAL", "COMPED"] as const;

async function getBaselinePreviewItems(): Promise<BaselinePreviewItem[]> {
  const accounts = await prisma.zernioAccount.findMany({
    where: {
      user: {
        accountStatus: { in: [...IMPACT_ELIGIBLE_STATUSES] },
      },
    },
    select: {
      userId: true,
      platform: true,
      connectedAt: true,
      connectionPeriodId: true,
    },
  });
  const userIds = [...new Set(accounts.map((account) => account.userId))];
  const [baselines, followerStats, posts] = await Promise.all([
    prisma.memberGrowthBaseline.findMany({ where: { userId: { in: userIds } } }),
    prisma.followerStats.findMany({
      where: { userId: { in: userIds } },
      orderBy: { date: "asc" },
    }),
    prisma.postAnalytics.findMany({
      where: { userId: { in: userIds }, isDemo: false, platform: { not: null } },
      select: { userId: true, platform: true, publishedAt: true, views: true, likes: true, comments: true },
    }),
  ]);

  return accounts.map((account) => {
    const baseline = baselines.find(
      (item) => item.userId === account.userId && item.platform === account.platform
    );
    const connectionDay = utcStartOfDay(account.connectedAt);
    const earliestFollower = followerStats.find(
      (item) =>
        item.userId === account.userId &&
        item.platform === account.platform &&
        item.date >= connectionDay
    );
    if (!earliestFollower) {
      return {
        userId: account.userId,
        platform: account.platform,
        connectionPeriodId: account.connectionPeriodId,
        oldBaselineDate: baseline?.baselineDate.toISOString() ?? null,
        oldFollowerCount: baseline?.baselineFollowerCount ?? null,
        proposedDate: null,
        proposedFollowerCount: null,
        proposedEngagementRate: null,
        status: "NO_DATA",
        reason: "No follower observation exists after the current connection began.",
      };
    }

    const windowEnd = new Date(earliestFollower.date);
    windowEnd.setDate(windowEnd.getDate() + 30);
    const earlyPosts = posts.filter(
      (post) =>
        post.userId === account.userId &&
        post.platform?.toLowerCase() === account.platform.toLowerCase() &&
        post.publishedAt >= earliestFollower.date &&
        post.publishedAt <= windowEnd
    );

    return {
      userId: account.userId,
      platform: account.platform,
      connectionPeriodId: account.connectionPeriodId,
      oldBaselineDate: baseline?.baselineDate.toISOString() ?? null,
      oldFollowerCount: baseline?.baselineFollowerCount ?? null,
      proposedDate: earliestFollower.date.toISOString(),
      proposedFollowerCount: earliestFollower.followerCount,
      proposedEngagementRate: computeWeightedEngagementRate(earlyPosts),
      status: "READY",
      reason: baseline ? "Replace the existing baseline with current connection-period data." : "Create a connection-period baseline.",
    };
  });
}

export async function previewBaselineRebuild(): Promise<BaselinePreviewResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  try {
    const items = await getBaselinePreviewItems();
    const sourceFingerprint = impactSourceFingerprint(items);
    const run = await prisma.impactBaselineRebuildRun.create({
      data: {
        requestedByUserId: session.user.id!,
        definitionVersion: IMPACT_DEFINITION_VERSION,
        sourceFingerprint,
        items: {
          create: items.map((item) => ({
            userId: item.userId,
            platform: item.platform,
            connectionPeriodId: item.connectionPeriodId,
            oldBaselineDate: item.oldBaselineDate ? new Date(item.oldBaselineDate) : null,
            oldFollowerCount: item.oldFollowerCount,
            proposedDate: item.proposedDate ? new Date(item.proposedDate) : null,
            proposedFollowerCount: item.proposedFollowerCount,
            proposedEngagementRate: item.proposedEngagementRate,
            status: item.status,
            reason: item.reason,
          })),
        },
      },
    });
    return { success: true, runId: run.id, status: run.status, items };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to preview baselines" };
  }
}

export async function applyBaselineRebuild(runId: string): Promise<BaselinePreviewResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { success: false, error: "Unauthorized" };

  try {
    const run = await prisma.impactBaselineRebuildRun.findUnique({
      where: { id: runId },
      include: { items: true },
    });
    if (!run || run.status !== "PREVIEW") return { success: false, error: "Preview is missing or already applied" };

    let applied = 0;
    let skipped = 0;
    for (const item of run.items) {
      if (item.status !== "READY" || item.proposedDate == null || item.proposedFollowerCount == null) {
        skipped++;
        continue;
      }
      const account = await prisma.zernioAccount.findUnique({
        where: { userId_platform: { userId: item.userId, platform: item.platform } },
      });
      const [currentFollower, currentBaseline] = await Promise.all([
        account
          ? prisma.followerStats.findFirst({
              where: {
                userId: item.userId,
                platform: item.platform,
                date: { gte: utcStartOfDay(account.connectedAt) },
              },
              orderBy: { date: "asc" },
            })
          : null,
        prisma.memberGrowthBaseline.findUnique({
          where: { userId_platform: { userId: item.userId, platform: item.platform } },
        }),
      ]);
      const baselineUnchanged =
        (currentBaseline?.baselineDate.toISOString() ?? null) === item.oldBaselineDate &&
        (currentBaseline?.baselineFollowerCount ?? null) === item.oldFollowerCount;
      const unchanged =
        baselineUnchanged &&
        currentFollower?.date.toISOString() === item.proposedDate.toISOString() &&
        currentFollower.followerCount === item.proposedFollowerCount;
      if (!unchanged) {
        skipped++;
        await prisma.impactBaselineRebuildItem.update({
          where: { id: item.id },
          data: { status: "CONFLICT", reason: "Source data changed after preview." },
        });
        continue;
      }

      await prisma.memberGrowthBaseline.upsert({
        where: { userId_platform: { userId: item.userId, platform: item.platform } },
        update: {
          connectionPeriodId: item.connectionPeriodId,
          baselineDate: item.proposedDate,
          baselineFollowerCount: item.proposedFollowerCount,
          baselineEngagementRate: item.proposedEngagementRate,
        },
        create: {
          userId: item.userId,
          platform: item.platform,
          connectionPeriodId: item.connectionPeriodId,
          baselineDate: item.proposedDate,
          baselineFollowerCount: item.proposedFollowerCount,
          baselineEngagementRate: item.proposedEngagementRate,
        },
      });
      await prisma.impactBaselineRebuildItem.update({
        where: { id: item.id },
        data: { status: "APPLIED", appliedAt: new Date() },
      });
      applied++;
    }

    await prisma.impactBaselineRebuildRun.update({
      where: { id: run.id },
      data: { status: "APPLIED", appliedAt: new Date() },
    });
    revalidatePath("/admin/impact");
    return { success: true, runId: run.id, status: "APPLIED", applied, skipped };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to apply baseline preview" };
  }
}

export interface ImpactInsightResult {
  success: boolean;
  insight?: string;
  generatedAt?: string;
  dataThroughAt?: string | null;
  stale?: boolean;
  error?: string;
}

const IMPACT_INSIGHT_CACHE_KEY = "ai_impact_insight";

function insightNumbersAreGrounded(
  insight: string,
  impact: ImpactData
): boolean {
  const allowed = new Set<string>(["30", "7"]);
  const add = (value: number) => {
    if (Number.isFinite(value)) {
      allowed.add(String(value));
      allowed.add(String(Math.round(value)));
      allowed.add(value.toFixed(1));
      allowed.add(value.toFixed(2));
    }
  };
  add(impact.overview.connectedMembers);
  add(impact.overview.connectedAccounts);
  add(impact.overview.totalFollowersGained);
  add(impact.overview.avgFollowerGrowth);
  add(impact.overview.avgEngagementLift);
  add(impact.overview.totalViewsTracked);
  add(impact.overview.totalPostsTracked);
  add(impact.overview.activeUsers);
  add(impact.overview.accountsWithValidBaseline);
  add(impact.overview.accountsWithValidEngagement);
  for (const row of impact.platformBreakdown) {
    add(row.followersGained);
    add(row.avgGrowthPercent);
    add(row.accountCount);
  }
  for (const row of impact.cohortBreakdown) {
    add(row.accountCount);
    add(row.avgGrowthPercent);
    add(row.avgEngagementLift);
  }
  add(impact.usageCorrelation.activeUsers);
  add(impact.usageCorrelation.inactiveUsers);
  add(impact.usageCorrelation.activeAvgGrowth);
  add(impact.usageCorrelation.inactiveAvgGrowth);
  add(impact.usageCorrelation.activeAvgEngagement);
  add(impact.usageCorrelation.inactiveAvgEngagement);
  add(impact.usageCorrelation.activeAvgPosts);
  add(impact.usageCorrelation.inactiveAvgPosts);

  const numericTokens = insight.match(/\b\d[\d,.]*(?:%|[KMB])?\b/g) ?? [];
  return numericTokens.every((token) => {
    const normalized = token.replace(/,/g, "").replace(/%$/, "");
    if (allowed.has(token) || allowed.has(normalized)) return true;
    if (/[KMB]$/.test(normalized)) {
      const multiplier = normalized.endsWith("K") ? 1_000 : normalized.endsWith("M") ? 1_000_000 : 1_000_000_000;
      const value = Number(normalized.slice(0, -1)) * multiplier;
      return Number.isFinite(value) && allowed.has(String(value));
    }
    return false;
  });
}

export async function getCachedImpactInsight(): Promise<ImpactInsightResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const cached = await prisma.analyticsCache.findUnique({
    where: { key: IMPACT_INSIGHT_CACHE_KEY },
  });

  if (!cached) {
    return { success: true, insight: "" };
  }

  const current = await getImpactData();
  if ("error" in current) return { success: false, error: current.error };

  const data = cached.data as {
    insight?: string;
    sourceFingerprint?: string;
    dataThroughAt?: string | null;
  };
  const stale =
    cached.expiresAt != null && cached.expiresAt <= new Date()
      ? true
      : data.sourceFingerprint !== current.metadata.sourceFingerprint;
  return {
    success: true,
    insight: data.insight ?? "",
    generatedAt: cached.updatedAt.toISOString(),
    dataThroughAt: data.dataThroughAt ?? null,
    stale,
  };
}

export async function generateImpactInsight(options?: { systemToken?: string }): Promise<ImpactInsightResult> {
  const trustedSystemCall =
    typeof options?.systemToken === "string" &&
    options.systemToken.length > 0 &&
    options.systemToken === process.env.CRON_SECRET;
  if (!trustedSystemCall) {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return { success: false, error: "Unauthorized" };
    }
  }

  const impact = await loadImpactData();

  const {
    metadata,
    overview,
    platformBreakdown,
    cohortBreakdown,
    usageCorrelation,
  } = impact;

  if (trustedSystemCall) {
    const cached = await prisma.analyticsCache.findUnique({
      where: { key: IMPACT_INSIGHT_CACHE_KEY },
    });
    const cachedData = cached?.data as { insight?: string; sourceFingerprint?: string; dataThroughAt?: string | null } | undefined;
    if (
      cached &&
      cachedData?.insight &&
      cachedData.sourceFingerprint === metadata.sourceFingerprint &&
      cached.expiresAt != null &&
      cached.expiresAt > new Date()
    ) {
      return {
        success: true,
        insight: cachedData.insight,
        generatedAt: cached.updatedAt.toISOString(),
        dataThroughAt: cachedData.dataThroughAt ?? null,
      };
    }
  }

  if (overview.connectedMembers === 0) {
    return { success: false, error: "No connected members to analyze" };
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return { success: false, error: "AI service not configured" };
  }

  const model = await getAnthropicModel();

  const platformSummary = platformBreakdown
    .map((p) => `${p.platform}: ${p.accountCount} accounts, ${p.followersGained} followers gained, ${p.avgGrowthPercent.toFixed(1)}% avg growth`)
    .join("\n");

  const cohortSummary = cohortBreakdown
    .map((c) => `${c.cohort}: ${c.accountCount} members, ${c.avgGrowthPercent.toFixed(1)}% avg growth, ${c.avgEngagementLift.toFixed(2)}% avg engagement lift`)
    .join("\n");

  const usageSummary = `Active members (${usageCorrelation.activeUsers}): ${usageCorrelation.activeAvgGrowth.toFixed(1)}% avg growth, ${usageCorrelation.activeAvgEngagement.toFixed(2)}% avg engagement, ${usageCorrelation.activeAvgPosts.toFixed(0)} avg posts
Inactive members (${usageCorrelation.inactiveUsers}): ${usageCorrelation.inactiveAvgGrowth.toFixed(1)}% avg growth, ${usageCorrelation.inactiveAvgEngagement.toFixed(2)}% avg engagement, ${usageCorrelation.inactiveAvgPosts.toFixed(0)} avg posts`;

  const prompt = `You are a marketing analyst for The Local Post, a content intelligence platform that helps local creators and businesses grow on social media. Generate advertisement-ready analytics copy using the REAL numbers below.

PLATFORM-WIDE IMPACT DATA:
- Metric definition: ${metadata.definitionVersion}
- Scope: ${metadata.scopeLabel}
- Data through: ${metadata.dataThroughAt ?? "unknown"}
- Source fingerprint: ${metadata.sourceFingerprint}
- Connected members: ${overview.connectedMembers}
- Connected social accounts: ${overview.connectedAccounts}
- Total followers gained across all members: ${overview.totalFollowersGained}
- Average follower growth per member: ${overview.avgFollowerGrowth.toFixed(1)}%
- Average engagement rate lift: ${overview.avgEngagementLift.toFixed(2)}%
- Total views tracked: ${overview.totalViewsTracked}
- Total posts tracked: ${overview.totalPostsTracked}
- Active members (last 30 days): ${overview.activeUsers}
- Accounts with valid baselines: ${overview.accountsWithValidBaseline}
- Accounts with valid engagement comparisons: ${overview.accountsWithValidEngagement}

GROWTH BY PLATFORM:
${platformSummary || "No platform data"}

COHORT GROWTH (by join month):
${cohortSummary || "No cohort data"}

USAGE CORRELATION:
${usageSummary}

HUMAN WRITING RULES — CRITICAL:
- Never use em dashes (—) or en dashes (–). Use commas, periods, or parentheses instead.
- Never use semicolons.
- Never use these words: delve, tapestry, landscape (as metaphor), realm, beacon, unlock, unleash, harness, elevate, robust, seamless, cutting-edge, pivotal, multifaceted, comprehensive, myriad, plethora, testament, transformative, revolutionary, game-changer.
- Never use these phrases: "in today's fast-paced world", "at its core", "let's dive in", "here's the thing", "but here's the kicker", "furthermore", "moreover", "additionally", "in conclusion", "ultimately", "in essence", "at the end of the day", "it's important to note", "it's worth noting", "generally speaking", "not just X but Y".
- Do not hedge or present both sides. Be confident and direct.
- Vary sentence length. Mix short punchy sentences with longer ones. Fragments are fine.
- Use contractions naturally (it's, don't, you're, we'll).
- Do not stack three adjectives or three parallel phrases for rhythm.
- Write like a confident marketing analyst, not like a corporate report.

Generate TWO sections:

1. HEADLINE STAT (one punchy sentence, under 20 words, with a real number that would work on a landing page or ad)

2. MARKETING COPY (2-3 sentences, advertisement-ready, using real numbers from the data above. Sound confident but honest. Use "tracked" or "measured" language, not "guaranteed" or "caused by". Reference specific numbers like total followers gained, average growth percentage, engagement lift, or the active vs inactive comparison if it's compelling.)

Format your response as:
HEADLINE: [your headline here]
COPY: [your marketing copy here]

Keep total response under 150 words.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error (impact insight):", errorText);
      return { success: false, error: `AI service error (${response.status})` };
    }

    const data = await response.json();
    const rawInsight = data.content?.[0]?.text?.trim() || "";

    if (!rawInsight) {
      return { success: false, error: "No insight generated" };
    }
    if (!insightNumbersAreGrounded(rawInsight, impact)) {
      return { success: false, error: "Insight included a number outside the verified impact data" };
    }

    const generatedAt = new Date();
    await prisma.analyticsCache.upsert({
      where: { key: IMPACT_INSIGHT_CACHE_KEY },
      update: {
        data: {
          insight: rawInsight,
          sourceFingerprint: metadata.sourceFingerprint,
          definitionVersion: metadata.definitionVersion,
          dataThroughAt: metadata.dataThroughAt,
        },
        expiresAt: new Date(generatedAt.getTime() + 6 * 60 * 60 * 1000),
      },
      create: {
        key: IMPACT_INSIGHT_CACHE_KEY,
        data: {
          insight: rawInsight,
          sourceFingerprint: metadata.sourceFingerprint,
          definitionVersion: metadata.definitionVersion,
          dataThroughAt: metadata.dataThroughAt,
        },
        expiresAt: new Date(generatedAt.getTime() + 6 * 60 * 60 * 1000),
      },
    });

    revalidatePath("/admin/impact");

    return {
      success: true,
      insight: rawInsight,
      generatedAt: generatedAt.toISOString(),
      dataThroughAt: metadata.dataThroughAt,
    };
  } catch (err) {
    console.error("Impact insight generation failed:", err);
    return { success: false, error: "Failed to generate insight" };
  }
}
