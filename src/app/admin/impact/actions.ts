"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicApiKey, getAnthropicModel } from "@/lib/platform-config";
import { revalidatePath } from "next/cache";
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

export interface ImpactData {
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

  return {
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

export interface ImpactInsightResult {
  success: boolean;
  insight?: string;
  generatedAt?: string;
  error?: string;
}

const IMPACT_INSIGHT_CACHE_KEY = "ai_impact_insight";

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

  const data = cached.data as { insight: string };
  return { success: true, insight: data.insight, generatedAt: cached.updatedAt.toISOString() };
}

export async function generateImpactInsight(): Promise<ImpactInsightResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const [overview, memberRows] = await Promise.all([
    getImpactOverview(),
    getMemberGrowthRows(),
  ]);
  const [platformBreakdown, cohortBreakdown, usageCorrelation] =
    await Promise.all([
      getPlatformGrowthBreakdown(memberRows),
      getCohortGrowthBreakdown(memberRows),
      getUsageCorrelationStats(memberRows),
    ]);

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

    await prisma.analyticsCache.upsert({
      where: { key: IMPACT_INSIGHT_CACHE_KEY },
      update: { data: { insight: rawInsight } },
      create: { key: IMPACT_INSIGHT_CACHE_KEY, data: { insight: rawInsight } },
    });

    revalidatePath("/admin/impact");

    return { success: true, insight: rawInsight };
  } catch (err) {
    console.error("Impact insight generation failed:", err);
    return { success: false, error: "Failed to generate insight" };
  }
}
