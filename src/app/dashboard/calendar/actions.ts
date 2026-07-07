"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { generateAIInsight } from "../actions";
import { getPlatformConfig, type PlatformConfigData } from "@/lib/platform-config";
import { checkActionRateLimit, formatRetryTime } from "@/lib/rate-limiter";
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
  type ArchivePostForFreshness,
  type QuestionnaireMaterial,
  type AnalyticsRowForFatigue,
} from "@/lib/freshness";

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
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const calendar = await prisma.calendar.findFirst({
    where: { userId: session.user.id },
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
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return { success: false, error: "Not authenticated" };
  }

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
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const calendarRow = await prisma.calendar.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!calendarRow) {
    return { success: true, insight: "Generate your first content calendar to get a personalized AI strategy note for the week." };
  }

  const calendar = calendarRow.contentJson as unknown as WeeklyCalendar;

  const cached = await prisma.analyticsCache.findUnique({
    where: { key: `calendar_strategy_${session.user.id}` },
  });

  const cachedData = cached?.data as { insight?: string; weekStarting?: string } | undefined;
  const isFresh = cached && cached.expiresAt && cached.expiresAt > new Date();
  const matchesWeek = cachedData?.weekStarting === calendar.weekStarting;
  const cacheIsNewerThanCalendar = cached && cached.updatedAt > calendarRow.updatedAt;

  if (cachedData?.insight && isFresh && matchesWeek && cacheIsNewerThanCalendar) {
    return { success: true, insight: cachedData.insight, generatedAt: cached.updatedAt.toISOString() };
  }

  return generateCalendarStrategy(session.user.id);
}

export async function generateWeeklyCalendar(timezoneOffsetHours: number = 0): Promise<{ success: boolean; error?: string }> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  const rateLimit = checkActionRateLimit(
    `calendar_gen:${session.user.id}`,
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
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!questionnaire) {
    return { success: false, error: "No questionnaire found. Please complete your onboarding first." };
  }

  const answers = questionnaire.content as unknown as QuestionnaireFormData;

  const profileSurveys = await prisma.profileSurvey.findMany({
    where: { userId: session.user.id },
    select: { surveyType: true, answersJson: true },
  });

  // #1: Expanded lookback for power users — scale with generation count
  // First, count total archived posts to determine lookback window
  const totalArchivedCount = await prisma.contentArchive.count({
    where: { userId: session.user.id },
  });
  const archiveTake = Math.min(Math.max(50, Math.ceil(totalArchivedCount / 100) * 50), 200);

  const recentArchived = await prisma.contentArchive.findMany({
    where: { userId: session.user.id },
    orderBy: { archivedAt: "desc" },
    take: archiveTake,
    select: { title: true, format: true, bucket: true, caption: true, hook: true, weekStarting: true },
  });

  // Count distinct weeks to estimate generation count
  const generationCount = new Set(recentArchived.map((p) => p.weekStarting)).size;

  const [config, trendHeadlines] = await Promise.all([
    getPlatformConfig(),
    fetchTrendingHeadlines(answers.industry),
  ]);
  const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    console.error("Anthropic API key is not configured");
    return { success: false, error: "API key not configured" };
  }

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
  const creativeConstraintsBlock = buildCreativeConstraintsBlock();
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

  const today = new Date();
  const currentDay = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const DAY_NAMES = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const;
  const targetDays = Array.from({ length: daysToPost }, (_, i) => DAY_NAMES[(today.getDay() + i) % 7]);
  const weekStarting = today.toISOString().split('T')[0];

  // Fetch best-time-to-post heatmaps for connected platforms
  const bestTimeRows = await prisma.bestTimeToPost.findMany({
    where: { userId: session.user.id },
    select: { platform: true, heatmap: true },
  });
  const bestTimesBlock = buildBestTimesBlock(
    bestTimeRows.map((r) => ({ platform: r.platform, heatmap: r.heatmap })),
    targetDays as string[],
    timezoneOffsetHours
  );

  // Fetch demographics for AI content generation (e.g., "Your audience is 65% women aged 25-34")
  const demographicsRows = await prisma.deepAnalytics.findMany({
    where: { userId: session.user.id, dataType: "demographics" },
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
      where: { userId: session.user.id, publishedAt: { gte: ninetyDaysAgo } },
      select: { title: true, format: true, views: true, likes: true, comments: true, publishedAt: true },
    }),
    prisma.followerStats.findMany({
      where: { userId: session.user.id, date: { gte: thirtyDaysAgo } },
      select: { platform: true, date: true, followerCount: true, growthDelta: true },
    }),
    prisma.deepAnalytics.findMany({
      where: { userId: session.user.id, dataType: { in: ["posting_frequency", "content_decay"] } },
      select: { platform: true, dataType: true, data: true },
    }),
    prisma.contentFeedback.findMany({
      where: { userId: session.user.id },
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
  const relevantMemories = await getRelevantMemories(session.user.id);
  const memoryBlock = summarizeMemoriesForPrompt(relevantMemories);

  const formatMixStr = daysToPost === 1 ? '1 Reel (only one post, make it count)' : daysToPost === 2 ? '1 Reel and 1 Carousel (maximum variety)' : `approx 60% Reels, 30% Carousels, 10% Static posts, but ensure at least one of each format if ${daysToPost} >= 3`;
  const bucketDistStr = `- For ${daysToPost} days, aim for roughly: ${Math.ceil(daysToPost / 3)} Personal, ${Math.ceil(daysToPost / 3)} Expert, ${Math.floor(daysToPost / 3)} Local (adjust by ±1 as needed, but never skip a bucket entirely if days >= 3).\n- Personal and Expert posts should be roughly equal. Do NOT let Expert dominate the week.`;

  const defaultUserPrompt = `${memoryBlock ? `${memoryBlock}\n\n` : ""}${userProfileXml}
${usedTitlesXml ? `\n${usedTitlesXml}` : ""}
${usedHooksBlock ? `\n${usedHooksBlock}` : ""}
${archetypeHistoryBlock ? `\n${archetypeHistoryBlock}` : ""}
${themesExploredBlock ? `\n${themesExploredBlock}` : ""}
${anecdoteCooldownBlock ? `\n${anecdoteCooldownBlock}` : ""}
${contentGapBlock ? `\n${contentGapBlock}` : ""}
${variationDirectiveBlock ? `\n${variationDirectiveBlock}` : ""}
${creativeConstraintsBlock ? `\n${creativeConstraintsBlock}` : ""}
${temporalContextBlock ? `\n${temporalContextBlock}` : ""}
${arcDirectiveBlock ? `\n${arcDirectiveBlock}` : ""}
${audienceFatigueBlock ? `\n${audienceFatigueBlock}` : ""}
${bestTimesBlock ? `\n${bestTimesBlock}` : ""}
${demographicsBlock ? `\n${demographicsBlock}` : ""}
${performanceBlock ? `\n${performanceBlock}` : ""}
${contentPerformanceBlock ? `\n${contentPerformanceBlock}` : ""}
${followerTrendBlock ? `\n${followerTrendBlock}` : ""}
${cadenceBlock ? `\n${cadenceBlock}` : ""}
${feedbackBlock ? `\n${feedbackBlock}` : ""}
${trendingTopicsBlock ? `\n${trendingTopicsBlock}` : ""}

<generation_instructions>
Generate a ${daysToPost}-day content calendar starting today, which is ${currentDay}, and running for the next ${daysToPost} consecutive days.

The days must be, in order: ${targetDays.join(", ")}.

The mix must be: ${formatMixStr}. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

BUCKET DISTRIBUTION: this is the most important balance to get right:
${bucketDistStr}

Days must be one of: ${targetDays.join(", ")}.
</generation_instructions>`;

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
      if (stopReason === "max_tokens") {
        return { success: false, error: "The AI response was too long and got cut off. Please try again." };
      }
      return { success: false, error: "Failed to parse AI response. Please try again." };
    }

    if (!Array.isArray(calendarData.days) || calendarData.days.length < daysToPost) {
      console.error("AI returned insufficient days:", JSON.stringify(calendarData));
      return { success: false, error: "AI returned an incomplete calendar. Please try again." };
    }

    calendarData.weekStarting = weekStarting;
    calendarData.days = targetDays.map((dayName, index) => ({
      ...calendarData.days[index],
      day: dayName,
    }));

    const existing = await prisma.calendar.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await prisma.calendar.update({
        where: { id: existing.id },
        data: { contentJson: calendarData as unknown as Prisma.InputJsonValue },
      });
    } else {
      await prisma.calendar.create({
        data: {
          userId: session.user.id,
          weekNumber: 1,
          contentJson: calendarData as unknown as Prisma.InputJsonValue,
        },
      });
    }

    // Touch memories that were used in this prompt (updates lastUsedAt)
    if (relevantMemories.length > 0) {
      touchMemories(relevantMemories.map((m) => m.id)).catch((err) =>
        console.error("Memory touch failed:", err)
      );
    }

    // Run learning pipeline in the background — may create new memories from analytics/feedback
    runLearningPipeline(session.user.id).catch((err) =>
      console.error("Memory learning pipeline failed:", err)
    );

    // Generate AI insight in the background
    generateAIInsight(session.user.id).catch((err) =>
      console.error("Background AI insight generation failed:", err)
    );

    // Generate AI strategy note in the background — CalendarStrategyNote component
    // loads it async via getCachedCalendarStrategy(), so no need to block the response
    generateCalendarStrategy(session.user.id, config).catch((err) =>
      console.error("Calendar strategy generation failed:", err)
    );

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("Error generating calendar:", error);
    return { success: false, error: "Failed to generate calendar. Please try again." };
  }
}

export async function addToArchive(
  weekStarting: string,
  dayIndex: number,
  day: CalendarDay
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.contentArchive.upsert({
    where: {
      userId_weekStarting_dayIndex: {
        userId: session.user.id,
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
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.contentArchive.deleteMany({
    where: {
      userId: session.user.id,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.contentFeedback.upsert({
    where: {
      userId_weekStarting_dayIndex: {
        userId: session.user.id,
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
      userId: session.user.id,
      weekStarting,
      dayIndex,
      title: dayContent.title,
      format: dayContent.format,
      bucket: dayContent.bucket,
      feedback,
    },
  });

  // Learn from feedback — creates warning memories for thumbs-down (background)
  learnFromFeedback(session.user.id, feedback, dayContent).catch((err) =>
    console.error("Memory learning from feedback failed:", err)
  );

  revalidatePath("/dashboard/calendar");
}
