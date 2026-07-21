"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { generateAIInsight } from "../actions";
import { getPlatformConfig, type PlatformConfigData } from "@/lib/platform-config";
import { checkActionRateLimit, formatRetryTime } from "@/lib/rate-limiter";
import { requireDashboardAccess } from "@/lib/server-access";
import {
  buildUserProfileXml,
  buildUsedTitlesBlock,
  buildTrendingTopicsBlock,
  CALENDAR_SYSTEM_PROMPT,
  CALENDAR_STRATEGY_SYSTEM_PROMPT,
} from "@/lib/prompt-builder";
import { fetchTrendingHeadlines } from "@/lib/rss-trends";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import {
  DAY_NAMES,
  DAY_LABELS_SHORT,
  bestSlotForDay,
  formatHour,
  shiftGridToTimezone,
  formatOffset,
  type HeatmapData,
} from "@/lib/best-time";
import { summarizeDemographicsForAI, type ContentDecay, type PostingFrequency } from "@/lib/deep-analytics";
import {
  buildPerformanceSignalsBlock,
  buildContentPerformanceBlock,
  buildFollowerTrendBlock,
  buildCadenceBlock,
  buildFeedbackBlock,
  matchArchiveToAnalytics,
} from "@/lib/performance-prompt";
import { getRelevantMemories, touchMemories } from "@/lib/memory/memory-service";
import { summarizeMemoriesForPrompt } from "@/lib/memory/memory-summarizer";
import { runLearningPipeline, learnFromFeedback } from "@/lib/memory/memory-builder";
import {
  buildUsedHooksBlock,
  buildArchetypeHistoryBlock,
  buildThemesExploredBlock,
  buildCreativeConstraintsBlock,
  buildVariationDirectiveBlock,
  buildAnecdoteCooldownBlock,
  buildContentGapBlock,
  buildTemporalContextBlock,
  buildAudienceFatigueBlock,
  buildArcDirectiveBlock,
  buildDynamicConstraintsPrompt,
  DYNAMIC_CONSTRAINTS_THRESHOLD,
  buildStalenessWarningBlock,
  buildSeasonalHistoryBlock,
  computeFreshnessScore,
  type ArchivePostForFreshness,
  type QuestionnaireMaterial,
  type AnalyticsRowForFatigue,
} from "@/lib/freshness";
import { buildBudgetedPrompt, type PromptBlock, type BudgetedBlockMetadata } from "@/lib/prompt-budget";

export type ContentFormat = "Reel" | "Carousel" | "Static";
export type ContentBucket = "Personal" | "Expert" | "Local";

export interface CalendarDay {
  day: string;
  format: ContentFormat;
  bucket: ContentBucket;
  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  musicSuggestion?: string;
  duration?: string;
  directions?: string;
}

export interface WeeklyCalendar {
  weekStarting: string;
  days: CalendarDay[];
}

export interface CalendarStrategyResult {
  success: boolean;
  insight?: string;
  generatedAt?: string;
  error?: string;
}

function buildBestTimesBlock(
  bestTimeRows: { platform: string; heatmap: unknown }[],
  targetDays: string[],
  timezoneOffsetHours: number
): string {
  if (bestTimeRows.length === 0) return "";

  const lines: string[] = [];
  for (const dayName of targetDays) {
    const dayIdx = DAY_NAMES.findIndex((d) => d === dayName.toUpperCase());
    if (dayIdx < 0) continue;
    const platformTimes: string[] = [];
    for (const row of bestTimeRows) {
      const heatmap = row.heatmap as HeatmapData;
      if (!heatmap?.grid) continue;
      const localGrid = shiftGridToTimezone(heatmap.grid, timezoneOffsetHours);
      const slot = bestSlotForDay(localGrid, dayIdx);
      if (slot) {
        const platformLabel = row.platform.charAt(0).toUpperCase() + row.platform.slice(1);
        platformTimes.push(`${platformLabel}: ${formatHour(slot.hour)}`);
      }
    }
    if (platformTimes.length > 0) {
      lines.push(`- ${dayName}: ${platformTimes.join(", ")}`);
    }
  }

  if (lines.length === 0) return "";

  const tzLabel = `UTC${formatOffset(timezoneOffsetHours)}`;
  return `<best_posting_times>
Based on the creator's historical engagement data, these are the optimal posting times (${tzLabel}) for each scheduled day. Align content suggestions with these windows when possible:
${lines.join("\n")}
</best_posting_times>`;
}

export async function getWeeklyCalendar(): Promise<(WeeklyCalendar & { updatedAt: string }) | null> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return null;
  const userId = access.user.id;

  const calendar = await prisma.calendar.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!calendar) {
    return null;
  }

  const content = calendar.contentJson as unknown as WeeklyCalendar;
  return { ...content, updatedAt: calendar.updatedAt.toISOString() };
}

export async function generateCalendarStrategy(
  userId: string,
  existingConfig?: PlatformConfigData,
): Promise<CalendarStrategyResult> {
  const access = await requireDashboardAccess({ expectedUserId: userId });
  if (!access.allowed) return { success: false, error: access.error };

  const calendarRow = await prisma.calendar.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!calendarRow) {
    return { success: false, error: "No calendar found" };
  }

  const calendar = calendarRow.contentJson as unknown as WeeklyCalendar;
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const answers = (questionnaire?.content ?? {}) as unknown as QuestionnaireFormData;

  const config = existingConfig ?? await getPlatformConfig();
  const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    return { success: false, error: "AI service not configured" };
  }

  const model = config.anthropicModel || "claude-opus-4-8";

  const formatCounts = calendar.days.reduce((acc, day) => {
    acc[day.format] = (acc[day.format] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const bucketCounts = calendar.days.reduce((acc, day) => {
    acc[day.bucket] = (acc[day.bucket] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const daySummary = calendar.days.map((day) =>
    `${day.day}: ${day.format}, ${day.bucket}, "${day.title}"`
  ).join("\n");

  const userProfileXml = buildUserProfileXml({
    answers,
    profileSurveys: [],
  });

  const defaultUserPrompt = `<calendar_data>
Calendar starts ${calendar.weekStarting}.

FORMAT MIX:
${Object.entries(formatCounts).map(([fmt, count]) => `- ${fmt}: ${count}`).join("\n")}

BUCKET MIX:
${Object.entries(bucketCounts).map(([bucket, count]) => `- ${bucket}: ${count}`).join("\n")}

UPCOMING DAYS:
${daySummary}
</calendar_data>

${userProfileXml}

Write the strategy note now.`;

  const systemPrompt = config.calendarStrategyPromptTemplate ?? CALENDAR_STRATEGY_SYSTEM_PROMPT;
  const userPrompt = (config.calendarStrategyPromptTemplate ?? defaultUserPrompt)
    .replace(/\{\{weekStarting\}\}/g, calendar.weekStarting)
    .replace(/\{\{formatMix\}\}/g, Object.entries(formatCounts).map(([fmt, count]) => `- ${fmt}: ${count}`).join("\n"))
    .replace(/\{\{bucketMix\}\}/g, Object.entries(bucketCounts).map(([bucket, count]) => `- ${bucket}: ${count}`).join("\n"))
    .replace(/\{\{daySummary\}\}/g, daySummary);

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
        max_tokens: 250,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error (calendar strategy):", errorText);
      return { success: false, error: `AI service error (${response.status})` };
    }

    const data = await response.json();
    const insight = data.content?.[0]?.text?.trim() || "";

    if (!insight) {
      return { success: false, error: "No strategy note generated" };
    }

    await prisma.analyticsCache.upsert({
      where: { key: `calendar_strategy_${userId}` },
      update: { data: { insight, weekStarting: calendar.weekStarting }, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: { key: `calendar_strategy_${userId}`, data: { insight, weekStarting: calendar.weekStarting }, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });

    return { success: true, insight, generatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("Calendar strategy generation failed:", err);
    return { success: false, error: "Failed to generate strategy note" };
  }
}

export async function getCachedCalendarStrategy(): Promise<CalendarStrategyResult> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };
  const userId = access.user.id;

  const calendarRow = await prisma.calendar.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!calendarRow) {
    return { success: true, insight: "Generate your first content calendar to get a personalized AI strategy note for the week." };
  }

  const calendar = calendarRow.contentJson as unknown as WeeklyCalendar;

  const cached = await prisma.analyticsCache.findUnique({
    where: { key: `calendar_strategy_${userId}` },
  });

  const cachedData = cached?.data as { insight?: string; weekStarting?: string } | undefined;
  const isFresh = cached && cached.expiresAt && cached.expiresAt > new Date();
  const matchesWeek = cachedData?.weekStarting === calendar.weekStarting;
  const cacheIsNewerThanCalendar = cached && cached.updatedAt > calendarRow.updatedAt;

  if (cachedData?.insight && isFresh && matchesWeek && cacheIsNewerThanCalendar) {
    return { success: true, insight: cachedData.insight, generatedAt: cached.updatedAt.toISOString() };
  }

  return generateCalendarStrategy(userId);
}

interface GenerationLogContext {
  userId: string;
  success: boolean;
  daysGenerated?: number;
  freshnessScore?: number | null;
  archetypeDiversity?: number | null;
  themeDiversity?: number | null;
  hookSimilarity?: number | null;
  stalenessTriggered?: boolean;
  audienceFatigueTriggered?: boolean;
  dynamicConstraintsMode?: string;
  dynamicConstraintsFallback?: boolean;
  blockMetadata?: { included: BudgetedBlockMetadata[]; trimmed: BudgetedBlockMetadata[]; omitted: BudgetedBlockMetadata[] };
  errorMessage?: string;
  durationMs?: number;
}

function logCalendarGeneration(ctx: GenerationLogContext): void {
  prisma.calendarGenerationLog
    .create({
      data: {
        userId: ctx.userId,
        success: ctx.success,
        daysGenerated: ctx.daysGenerated ?? null,
        freshnessScore: ctx.freshnessScore ?? null,
        archetypeDiversity: ctx.archetypeDiversity ?? null,
        themeDiversity: ctx.themeDiversity ?? null,
        hookSimilarity: ctx.hookSimilarity ?? null,
        stalenessTriggered: ctx.stalenessTriggered ?? false,
        audienceFatigueTriggered: ctx.audienceFatigueTriggered ?? false,
        dynamicConstraintsMode: ctx.dynamicConstraintsMode ?? null,
        dynamicConstraintsFallback: ctx.dynamicConstraintsFallback ?? false,
        blockMetadata: (ctx.blockMetadata ?? null) as unknown as Prisma.InputJsonValue,
        errorMessage: ctx.errorMessage ?? null,
        durationMs: ctx.durationMs ?? null,
      },
    })
    .catch((err: unknown) => console.error("Calendar generation log write failed:", err));
}

export async function generateWeeklyCalendar(timezoneOffsetHours: number = 0): Promise<{ success: boolean; error?: string }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };
  const userId = access.user.id;

  const rateLimit = await checkActionRateLimit(
    `calendar_gen:${userId}`,
    5,
    10 * 60 * 1000
  );
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Too many calendar generations. Please try again in ${formatRetryTime(rateLimit.retryAfterMs ?? 0)}.`,
    };
  }

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!questionnaire) {
    return { success: false, error: "No questionnaire found. Please complete your onboarding first." };
  }

  const answers = questionnaire.content as unknown as QuestionnaireFormData;

  const profileSurveys = await prisma.profileSurvey.findMany({
    where: { userId },
    select: { surveyType: true, answersJson: true },
  });

  // #1: Expanded lookback for power users — scale with generation count
  // First, count total archived posts to determine lookback window
  const totalArchivedCount = await prisma.contentArchive.count({
    where: { userId },
  });
  const archiveTake = Math.min(Math.max(50, Math.ceil(totalArchivedCount / 100) * 50), 200);

  const recentArchived = await prisma.contentArchive.findMany({
    where: { userId },
    orderBy: { archivedAt: "desc" },
    take: archiveTake,
    select: { title: true, format: true, bucket: true, caption: true, hook: true, weekStarting: true },
  });

  // Count distinct weeks to estimate generation count
  const generationCount = new Set(recentArchived.map((p) => p.weekStarting)).size;

  // #10: Seasonal / cross-year awareness — fetch posts from 11-13 months ago
  // to prevent repeating the same seasonal content year over year
  const seasonalStart = new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000);
  const seasonalEnd = new Date(Date.now() - 11 * 30 * 24 * 60 * 60 * 1000);

  const [config, trendHeadlines, seasonalArchived] = await Promise.all([
    getPlatformConfig(),
    fetchTrendingHeadlines(answers.industry),
    prisma.contentArchive.findMany({
      where: {
        userId,
        archivedAt: { gte: seasonalStart, lte: seasonalEnd },
      },
      orderBy: { archivedAt: "desc" },
      take: 20,
      select: { title: true, hook: true, bucket: true, format: true, weekStarting: true },
    }),
  ]);
  const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    console.error("Anthropic API key is not configured");
    return { success: false, error: "API key not configured" };
  }

  const seasonalPosts: ArchivePostForFreshness[] = seasonalArchived.map((p) => ({
    title: p.title,
    hook: p.hook,
    bucket: p.bucket,
    format: p.format,
    weekStarting: p.weekStarting,
  }));
  const seasonalHistoryBlock = buildSeasonalHistoryBlock(seasonalPosts);

  const model = config.anthropicModel || "claude-opus-4-8";

  const usedTitlesXml = buildUsedTitlesBlock(recentArchived.map((p: { title: string }) => p.title));
  const trendingTopicsBlock = buildTrendingTopicsBlock(trendHeadlines);

  // Freshness blocks — combat staleness on repeated calendar generations
  const freshnessPosts: ArchivePostForFreshness[] = recentArchived.map((p) => ({
    title: p.title,
    hook: p.hook,
    bucket: p.bucket,
    format: p.format,
    weekStarting: p.weekStarting,
  }));
  const usedHooksBlock = buildUsedHooksBlock(freshnessPosts);
  const archetypeHistoryBlock = buildArchetypeHistoryBlock(freshnessPosts);
  const themesExploredBlock = buildThemesExploredBlock(freshnessPosts);

  // Dynamic LLM-generated constraints for power users (generation count ≥ threshold).
  // Makes a lightweight pre-generation API call asking Claude to propose constraints
  // that target this creator's specific unexplored territory. Falls back to the static
  // pool on any failure.
  let dynamicConstraints: string[] | undefined;
  let dynamicConstraintsMode: "dynamic" | "static" | "none" = "none";
  let dynamicConstraintsFallback = false;
  if (generationCount >= DYNAMIC_CONSTRAINTS_THRESHOLD && freshnessPosts.length >= 8) {
    const constraintsPrompt = buildDynamicConstraintsPrompt(freshnessPosts, generationCount);
    if (constraintsPrompt) {
      try {
        const constraintsResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 500,
            system: constraintsPrompt.system,
            messages: [{ role: "user", content: constraintsPrompt.user }],
          }),
        });
        if (constraintsResponse.ok) {
          const constraintsData = await constraintsResponse.json();
          const constraintsText: string = constraintsData.content?.[0]?.text || "";
          dynamicConstraints = constraintsText
            .split("\n")
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0);
          dynamicConstraintsMode = "dynamic";
        } else {
          dynamicConstraintsMode = "static";
          dynamicConstraintsFallback = true;
        }
      } catch (err) {
        console.error("Dynamic constraints generation failed, falling back to static pool:", err);
        dynamicConstraintsMode = "static";
        dynamicConstraintsFallback = true;
      }
    } else {
      dynamicConstraintsMode = "static";
    }
  } else {
    dynamicConstraintsMode = "static";
  }
  const creativeConstraintsBlock = buildCreativeConstraintsBlock(undefined, dynamicConstraints);
  const variationDirectiveBlock = buildVariationDirectiveBlock(generationCount);

  // #2: Anecdote cooldown — extract questionnaire/survey material and check usage
  const questionnaireMaterial: QuestionnaireMaterial[] = [
    { label: "Personal Story", value: answers.personalStory },
    { label: "Recent Win", value: answers.recentWin },
    { label: "Hot Takes", value: answers.hotTakes },
    { label: "Morning Routine", value: answers.morningRoutine },
    { label: "FAQ Top 3", value: answers.faqTop3 },
    { label: "Numbers That Impress", value: answers.numbersThatImpress },
    { label: "Seasonal Rhythm", value: answers.seasonalRhythm },
    { label: "Upcoming Events", value: answers.upcomingEvents },
    { label: "Family Context", value: answers.familyContext },
    { label: "Content Boundaries", value: answers.contentBoundaries },
  ];
  // Add industry-branched answers
  if (answers.industryAnswers) {
    for (const [key, value] of Object.entries(answers.industryAnswers)) {
      if (typeof value === "string" && value.trim().length > 10) {
        questionnaireMaterial.push({ label: `Industry: ${key}`, value });
      }
    }
  }
  const anecdoteCooldownBlock = buildAnecdoteCooldownBlock(questionnaireMaterial, freshnessPosts);

  // #3: Content gap analysis — find untapped questionnaire material
  const contentGapBlock = buildContentGapBlock(questionnaireMaterial, freshnessPosts);

  // #6: Temporal context — current date, season, upcoming holidays
  const temporalContextBlock = buildTemporalContextBlock();

  // #5 + #7: Weekly/monthly context surveys are now fetched from ProfileSurvey and
  // injected via buildUserProfileXml → buildDeepDiveSurveysBlock as <weekly_context> and <monthly_context> tags.
  // The monthly theme also drives the arc directive.
  const monthlyContextSurvey = profileSurveys.find((s) => s.surveyType === "MONTHLY_CONTEXT");
  const monthlyContextAnswers = (monthlyContextSurvey?.answersJson ?? {}) as Record<string, string>;
  const arcDirectiveBlock = buildArcDirectiveBlock(monthlyContextAnswers.monthlyTheme ?? "");

  const userProfileXml = buildUserProfileXml({
    answers,
    profileSurveys: profileSurveys as unknown as { surveyType: string; answersJson: unknown }[],
  });

  const parsedDaysToPost = Number(answers.daysToPost);
  const daysToPost =
    Number.isInteger(parsedDaysToPost) && parsedDaysToPost >= 1 && parsedDaysToPost <= 7
      ? parsedDaysToPost
      : 3;

  // Compute the user's LOCAL "today" from their timezone offset (local = UTC + offsetHours),
  // so currentDay, targetDays, and weekStarting all agree regardless of the server's timezone.
  // Without this, a late-evening generation west of UTC stores tomorrow's UTC date as
  // weekStarting while targetDays is derived from the local weekday — shifting the calendar a day.
  const localNow = new Date(Date.now() + timezoneOffsetHours * 60 * 60 * 1000);
  const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
  const currentDayIdx = localNow.getUTCDay();
  const currentDay = DAY_NAMES[currentDayIdx];
  const targetDays = Array.from({ length: daysToPost }, (_, i) => DAY_NAMES[(currentDayIdx + i) % 7]);
  const weekStarting = `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, "0")}-${String(localNow.getUTCDate()).padStart(2, "0")}`;

  // Fetch best-time-to-post heatmaps for connected platforms
  const bestTimeRows = await prisma.bestTimeToPost.findMany({
    where: { userId },
    select: { platform: true, heatmap: true },
  });
  const bestTimesBlock = buildBestTimesBlock(
    bestTimeRows.map((r) => ({ platform: r.platform, heatmap: r.heatmap })),
    targetDays as string[],
    timezoneOffsetHours
  );

  // Fetch demographics for AI content generation (e.g., "Your audience is 65% women aged 25-34")
  const demographicsRows = await prisma.deepAnalytics.findMany({
    where: { userId, dataType: "demographics" },
    select: { platform: true, data: true },
  });
  const demographicsSummary = summarizeDemographicsForAI(
    demographicsRows.map((r) => ({ platform: r.platform, data: r.data as unknown as { kind: string; payload: unknown } }))
  );
  const demographicsBlock = demographicsSummary
    ? `<audience_demographics>\nBased on analytics data, here is the creator's audience composition. Tailor content tone, topics, and references to resonate with this audience:\n${demographicsSummary}\n</audience_demographics>`
    : "";

  // Analytics-driven context blocks
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [analyticsRows, followerRows, cadenceRows, feedbackRows] = await Promise.all([
    prisma.postAnalytics.findMany({
      where: { userId, publishedAt: { gte: ninetyDaysAgo } },
      select: { title: true, format: true, views: true, likes: true, comments: true, publishedAt: true },
    }),
    prisma.followerStats.findMany({
      where: { userId, date: { gte: thirtyDaysAgo } },
      select: { platform: true, date: true, followerCount: true, growthDelta: true },
    }),
    prisma.deepAnalytics.findMany({
      where: { userId, dataType: { in: ["posting_frequency", "content_decay"] } },
      select: { platform: true, dataType: true, data: true },
    }),
    prisma.contentFeedback.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { title: true, format: true, bucket: true, feedback: true },
    }),
  ]);

  const performanceBlock = buildPerformanceSignalsBlock(analyticsRows);

  // #8: Audience fatigue signal — compare recent vs previous engagement
  const fatigueRows: AnalyticsRowForFatigue[] = analyticsRows.map((r) => ({
    title: r.title,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    publishedAt: r.publishedAt,
  }));
  const audienceFatigueBlock = buildAudienceFatigueBlock(fatigueRows);
  const audienceFatigueTriggered = audienceFatigueBlock.length > 0;

  // #9: Proactive staleness score — leading indicator before engagement declines
  const stalenessWarningBlock = buildStalenessWarningBlock(freshnessPosts);
  const stalenessTriggered = stalenessWarningBlock.length > 0;
  const freshnessScoreResult = computeFreshnessScore(freshnessPosts);

  const matches = matchArchiveToAnalytics(recentArchived, analyticsRows);
  const contentPerformanceBlock = buildContentPerformanceBlock(matches);

  const followerTrendBlock = buildFollowerTrendBlock(followerRows);

  let postingFrequency: PostingFrequency | null = null;
  const decayByPlatform: { platform: string; decay: ContentDecay }[] = [];
  for (const row of cadenceRows) {
    const wrapped = row.data as unknown as { kind?: string; payload?: unknown };
    if (row.dataType === "posting_frequency" && wrapped?.kind === "postingFrequency" && wrapped.payload) {
      postingFrequency = wrapped.payload as PostingFrequency;
    }
    if (row.dataType === "content_decay" && wrapped?.kind === "contentDecay" && wrapped.payload) {
      decayByPlatform.push({ platform: row.platform, decay: wrapped.payload as ContentDecay });
    }
  }

  const feedbackBlock = buildFeedbackBlock(feedbackRows);

  const cadenceBlock = buildCadenceBlock(postingFrequency, decayByPlatform, daysToPost);

  // Load persistent AI memories (HIGH/CRITICAL + pinned) and build memory block
  const relevantMemories = await getRelevantMemories(userId);
  const memoryBlock = summarizeMemoriesForPrompt(relevantMemories);

  const formatMixStr = daysToPost === 1 ? '1 Reel (only one post, make it count)' : daysToPost === 2 ? '1 Reel and 1 Carousel (maximum variety)' : `approx 60% Reels, 30% Carousels, 10% Static posts, but ensure at least one of each format if ${daysToPost} >= 3`;
  const bucketDistStr = `- For ${daysToPost} days, aim for roughly: ${Math.ceil(daysToPost / 3)} Personal, ${Math.ceil(daysToPost / 3)} Expert, ${Math.floor(daysToPost / 3)} Local (adjust by ±1 as needed, but never skip a bucket entirely if days >= 3).\n- Personal and Expert posts should be roughly equal. Do NOT let Expert dominate the week.`;

  const generationInstructions = `<generation_instructions>
Generate a ${daysToPost}-day content calendar starting today, which is ${currentDay}, and running for the next ${daysToPost} consecutive days.

The days must be, in order: ${targetDays.join(", ")}. Post 1 is ${targetDays[0]}${targetDays.length > 1 ? `, post 2 is ${targetDays[1]}` : ""}, and so on. Any day-of-week or "today" reference inside a post's copy (hook, body, cta, caption) MUST match that post's assigned day. For example, the ${targetDays[0]} post must never say it is ${DAY_NAMES[(currentDayIdx + 1) % 7].charAt(0) + DAY_NAMES[(currentDayIdx + 1) % 7].slice(1).toLowerCase()} or any other weekday.

The mix must be: ${formatMixStr}. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

BUCKET DISTRIBUTION: this is the most important balance to get right:
${bucketDistStr}

Days must be one of: ${targetDays.join(", ")}.

MUSIC: Every post must include a musicSuggestion, regardless of format (Reel, Carousel, or Static). The creator overlays music on all their posts using Instagram's music sticker, so always pick a real, recognizable song with artist name that fits the mood.
</generation_instructions>`;

  // Assemble prompt blocks with priorities for budget management.
  // CRITICAL blocks (memory, user profile with compliance guardrails, generation instructions)
  // are always preserved regardless of budget pressure.
  const promptBlocks: PromptBlock[] = [
    { id: "creator_memory", content: memoryBlock, priority: "CRITICAL" },
    { id: "user_profile", content: userProfileXml, priority: "CRITICAL" },
    { id: "generation_instructions", content: generationInstructions, priority: "CRITICAL" },
    { id: "used_titles", content: usedTitlesXml, priority: "HIGH" },
    { id: "used_hooks", content: usedHooksBlock, priority: "HIGH" },
    { id: "archetype_history", content: archetypeHistoryBlock, priority: "HIGH" },
    { id: "staleness_warning", content: stalenessWarningBlock, priority: "HIGH" },
    { id: "audience_fatigue", content: audienceFatigueBlock, priority: "HIGH" },
    { id: "creative_constraints", content: creativeConstraintsBlock, priority: "HIGH" },
    { id: "variation_directive", content: variationDirectiveBlock, priority: "HIGH" },
    { id: "themes_explored", content: themesExploredBlock, priority: "MEDIUM" },
    { id: "anecdote_cooldown", content: anecdoteCooldownBlock, priority: "MEDIUM" },
    { id: "untapped_material", content: contentGapBlock, priority: "MEDIUM" },
    { id: "temporal_context", content: temporalContextBlock, priority: "MEDIUM" },
    { id: "seasonal_history", content: seasonalHistoryBlock, priority: "MEDIUM" },
    { id: "content_arc", content: arcDirectiveBlock, priority: "MEDIUM" },
    { id: "best_posting_times", content: bestTimesBlock, priority: "MEDIUM" },
    { id: "audience_demographics", content: demographicsBlock, priority: "MEDIUM" },
    { id: "performance_signals", content: performanceBlock, priority: "LOW", trimStrategy: "omit_if_over" },
    { id: "content_performance", content: contentPerformanceBlock, priority: "LOW", trimStrategy: "omit_if_over" },
    { id: "follower_trend", content: followerTrendBlock, priority: "LOW", trimStrategy: "omit_if_over" },
    { id: "cadence_insights", content: cadenceBlock, priority: "LOW", trimStrategy: "omit_if_over" },
    { id: "feedback", content: feedbackBlock, priority: "LOW", trimStrategy: "omit_if_over" },
    { id: "trending_topics", content: trendingTopicsBlock, priority: "LOW", trimStrategy: "omit_if_over" },
  ];

  const budgetedPrompt = buildBudgetedPrompt(promptBlocks);
  const defaultUserPrompt = budgetedPrompt.prompt;
  const generationStartTime = Date.now();

  const systemPrompt = (config.calendarPromptTemplate ?? CALENDAR_SYSTEM_PROMPT)
    .replace(/\{\{weekStarting\}\}/g, weekStarting)
    .replace(/\{\{firstDay\}\}/g, targetDays[0]);

  const userPrompt = (config.calendarPromptTemplate ? "" : defaultUserPrompt)
    .replace(/\{\{questionnaireAnswers\}\}/g, userProfileXml)
    .replace(/\{\{usedTitlesBlock\}\}/g, usedTitlesXml)
    .replace(/\{\{bestTimesBlock\}\}/g, bestTimesBlock)
    .replace(/\{\{demographicsBlock\}\}/g, demographicsBlock)
    .replace(/\{\{memoryBlock\}\}/g, memoryBlock)
    .replace(/\{\{performanceBlock\}\}/g, performanceBlock)
    .replace(/\{\{contentPerformanceBlock\}\}/g, contentPerformanceBlock)
    .replace(/\{\{followerTrendBlock\}\}/g, followerTrendBlock)
    .replace(/\{\{cadenceBlock\}\}/g, cadenceBlock)
    .replace(/\{\{feedbackBlock\}\}/g, feedbackBlock)
    .replace(/\{\{daysToPost\}\}/g, String(daysToPost))
    .replace(/\{\{currentDay\}\}/g, currentDay)
    .replace(/\{\{targetDays\}\}/g, targetDays.join(", "))
    .replace(/\{\{formatMix\}\}/g, formatMixStr)
    .replace(/\{\{bucketDistribution\}\}/g, bucketDistStr)
    .replace(/\{\{weekStarting\}\}/g, weekStarting)
    .replace(/\{\{firstDay\}\}/g, targetDays[0]);

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
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Anthropic API error:", errorData);
      logCalendarGeneration({
        userId,
        success: false,
        stalenessTriggered,
        audienceFatigueTriggered,
        dynamicConstraintsMode,
        dynamicConstraintsFallback,
        blockMetadata: { included: budgetedPrompt.included, trimmed: budgetedPrompt.trimmed, omitted: budgetedPrompt.omitted },
        errorMessage: `AI service error (${response.status})`,
        durationMs: Date.now() - generationStartTime,
      });
      return { success: false, error: "AI service error. Please try again." };
    }

    const data = await response.json();
    const responseText = data.content?.[0]?.text || "";
    const stopReason = data.stop_reason;

    let calendarData: WeeklyCalendar;
    try {
      calendarData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
      const parseErrorMsg = stopReason === "max_tokens"
        ? "The AI response was too long and got cut off. Please try again."
        : "Failed to parse AI response. Please try again.";
      logCalendarGeneration({
        userId,
        success: false,
        stalenessTriggered,
        audienceFatigueTriggered,
        dynamicConstraintsMode,
        dynamicConstraintsFallback,
        blockMetadata: { included: budgetedPrompt.included, trimmed: budgetedPrompt.trimmed, omitted: budgetedPrompt.omitted },
        errorMessage: parseErrorMsg,
        durationMs: Date.now() - generationStartTime,
      });
      if (stopReason === "max_tokens") {
        return { success: false, error: "The AI response was too long and got cut off. Please try again." };
      }
      return { success: false, error: "Failed to parse AI response. Please try again." };
    }

    if (!Array.isArray(calendarData.days) || calendarData.days.length < daysToPost) {
      console.error("AI returned insufficient days:", JSON.stringify(calendarData));
      logCalendarGeneration({
        userId,
        success: false,
        stalenessTriggered,
        audienceFatigueTriggered,
        dynamicConstraintsMode,
        dynamicConstraintsFallback,
        blockMetadata: { included: budgetedPrompt.included, trimmed: budgetedPrompt.trimmed, omitted: budgetedPrompt.omitted },
        errorMessage: "AI returned an incomplete calendar",
        durationMs: Date.now() - generationStartTime,
      });
      return { success: false, error: "AI returned an incomplete calendar. Please try again." };
    }

    calendarData.weekStarting = weekStarting;
    calendarData.days = targetDays.map((dayName, index) => ({
      ...calendarData.days[index],
      day: dayName,
    }));

    const existingCount = await prisma.calendar.count({
      where: { userId },
    });

    await prisma.calendar.create({
      data: {
        userId,
        weekNumber: existingCount + 1,
        contentJson: calendarData as unknown as Prisma.InputJsonValue,
      },
    });

    // Touch memories that were used in this prompt (updates lastUsedAt)
    if (relevantMemories.length > 0) {
      touchMemories(relevantMemories.map((m) => m.id)).catch((err) =>
        console.error("Memory touch failed:", err)
      );
    }

    // Run learning pipeline in the background — may create new memories from analytics/feedback
    runLearningPipeline(userId).catch((err) =>
      console.error("Memory learning pipeline failed:", err)
    );

    // Generate AI insight in the background
    generateAIInsight(userId).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );

    // Generate AI strategy note in the background — CalendarStrategyNote component
    // loads it async via getCachedCalendarStrategy(), so no need to block the response
    generateCalendarStrategy(userId, config).catch((err) =>
      console.error("Calendar strategy generation failed:", err)
    );

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");

    logCalendarGeneration({
      userId,
      success: true,
      daysGenerated: calendarData.days.length,
      freshnessScore: freshnessScoreResult?.score ?? null,
      archetypeDiversity: freshnessScoreResult?.archetypeDiversity ?? null,
      themeDiversity: freshnessScoreResult?.themeDiversity ?? null,
      hookSimilarity: freshnessScoreResult?.hookSimilarity ?? null,
      stalenessTriggered,
      audienceFatigueTriggered,
      dynamicConstraintsMode,
      dynamicConstraintsFallback,
      blockMetadata: { included: budgetedPrompt.included, trimmed: budgetedPrompt.trimmed, omitted: budgetedPrompt.omitted },
      durationMs: Date.now() - generationStartTime,
    });

    return { success: true };
  } catch (error) {
    console.error("Error generating calendar:", error);
    logCalendarGeneration({
      userId,
      success: false,
      stalenessTriggered,
      audienceFatigueTriggered,
      dynamicConstraintsMode,
      dynamicConstraintsFallback,
      blockMetadata: { included: budgetedPrompt.included, trimmed: budgetedPrompt.trimmed, omitted: budgetedPrompt.omitted },
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - generationStartTime,
    });
    return { success: false, error: "Failed to generate calendar. Please try again." };
  }
}

export async function addToArchive(
  weekStarting: string,
  dayIndex: number,
  day: CalendarDay
): Promise<void> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return;
  const userId = access.user.id;

  await prisma.contentArchive.upsert({
    where: {
      userId_weekStarting_dayIndex: {
        userId,
        weekStarting,
        dayIndex,
      },
    },
    update: {
      day: day.day,
      format: day.format,
      bucket: day.bucket,
      title: day.title,
      hook: day.hook,
      body: day.body,
      cta: day.cta,
      caption: day.caption,
      musicSuggestion: day.musicSuggestion,
      duration: day.duration,
    },
    create: {
      userId,
      weekStarting,
      dayIndex,
      day: day.day,
      format: day.format,
      bucket: day.bucket,
      title: day.title,
      hook: day.hook,
      body: day.body,
      cta: day.cta,
      caption: day.caption,
      musicSuggestion: day.musicSuggestion,
      duration: day.duration,
    },
  });

  revalidatePath("/dashboard/library");
}

export async function removeFromArchive(
  weekStarting: string,
  dayIndex: number
): Promise<void> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return;
  const userId = access.user.id;

  await prisma.contentArchive.deleteMany({
    where: {
      userId,
      weekStarting,
      dayIndex,
    },
  });

  revalidatePath("/dashboard/library");
}

export async function addFeedback(
  weekStarting: string,
  dayIndex: number,
  dayContent: CalendarDay,
  feedback: "up" | "down"
): Promise<void> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new Error(access.error);
  const userId = access.user.id;

  await prisma.contentFeedback.upsert({
    where: {
      userId_weekStarting_dayIndex: {
        userId,
        weekStarting,
        dayIndex,
      },
    },
    update: {
      title: dayContent.title,
      format: dayContent.format,
      bucket: dayContent.bucket,
      feedback,
    },
    create: {
      userId,
      weekStarting,
      dayIndex,
      title: dayContent.title,
      format: dayContent.format,
      bucket: dayContent.bucket,
      feedback,
    },
  });

  // Learn from feedback — creates warning memories for thumbs-down (background)
  learnFromFeedback(userId, feedback, dayContent).catch((err) =>
    console.error("Memory learning from feedback failed:", err)
  );

  revalidatePath("/dashboard/calendar");
}
