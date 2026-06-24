"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { generateAIInsight } from "../actions";
import { getPlatformConfig, type PlatformConfigData } from "@/lib/platform-config";
import {
  buildUserProfileXml,
  buildUsedTitlesBlock,
  CALENDAR_SYSTEM_PROMPT,
  CALENDAR_STRATEGY_SYSTEM_PROMPT,
} from "@/lib/prompt-builder";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";

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

export async function getWeeklyCalendar(): Promise<WeeklyCalendar | null> {
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
  return content;
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
    `${day.day}: ${day.format} — ${day.bucket} — "${day.title}"`
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

export async function generateWeeklyCalendar(): Promise<{ success: boolean; error?: string }> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
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

  const recentArchived = await prisma.contentArchive.findMany({
    where: { userId: session.user.id },
    orderBy: { archivedAt: "desc" },
    take: 50,
    select: { title: true },
  });

  const config = await getPlatformConfig();
  const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    console.error("Anthropic API key is not configured");
    return { success: false, error: "API key not configured" };
  }

  const model = config.anthropicModel || "claude-opus-4-8";

  const usedTitlesXml = buildUsedTitlesBlock(recentArchived.map((p: { title: string }) => p.title));

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

  const formatMixStr = daysToPost === 1 ? '1 Reel (only one post, make it count)' : daysToPost === 2 ? '1 Reel and 1 Carousel (maximum variety)' : `approx 60% Reels, 30% Carousels, 10% Static posts, but ensure at least one of each format if ${daysToPost} >= 3`;
  const bucketDistStr = `- For ${daysToPost} days, aim for roughly: ${Math.ceil(daysToPost / 3)} Personal, ${Math.ceil(daysToPost / 3)} Expert, ${Math.floor(daysToPost / 3)} Local (adjust by ±1 as needed, but never skip a bucket entirely if days >= 3).\n- Personal and Expert posts should be roughly equal. Do NOT let Expert dominate the week.`;

  const defaultUserPrompt = `${userProfileXml}
${usedTitlesXml ? `\n${usedTitlesXml}` : ""}

<generation_instructions>
Generate a ${daysToPost}-day content calendar starting today, which is ${currentDay}, and running for the next ${daysToPost} consecutive days.

The days must be, in order: ${targetDays.join(", ")}.

The mix must be: ${formatMixStr}. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

BUCKET DISTRIBUTION — this is the most important balance to get right:
${bucketDistStr}

Days must be one of: ${targetDays.join(", ")}.
</generation_instructions>`;

  const systemPrompt = (config.calendarPromptTemplate ?? CALENDAR_SYSTEM_PROMPT)
    .replace(/\{\{weekStarting\}\}/g, weekStarting)
    .replace(/\{\{firstDay\}\}/g, targetDays[0]);

  const userPrompt = (config.calendarPromptTemplate ? "" : defaultUserPrompt)
    .replace(/\{\{questionnaireAnswers\}\}/g, userProfileXml)
    .replace(/\{\{usedTitlesBlock\}\}/g, usedTitlesXml)
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
        max_tokens: 4000,
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

    let calendarData: WeeklyCalendar;
    try {
      calendarData = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse Claude response:", responseText);
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
    update: {},
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
