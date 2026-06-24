"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { generateAIInsight } from "../actions";
import { getAnthropicApiKey, getAnthropicModel, getPlatformConfig } from "@/lib/platform-config";

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

export async function generateCalendarStrategy(userId: string): Promise<CalendarStrategyResult> {
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

  const answersJson = questionnaire?.content ?? {};
  const answers = answersJson as Record<string, unknown>;
  const primaryGoal = typeof answers.primaryGoal === "string" && answers.primaryGoal ? answers.primaryGoal : null;
  const antiBrandWords = typeof answers.antiBrandWords === "string" && answers.antiBrandWords ? answers.antiBrandWords : null;

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return { success: false, error: "AI service not configured" };
  }

  const model = await getAnthropicModel();

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

  const goalBlock = primaryGoal
    ? `\n\nThe user's PRIMARY MARKETING GOAL is: "${primaryGoal}".`
    : "";

  const guardrailBlock = antiBrandWords
    ? `\n\nVOCABULARY GUARDRAILS — never use these words/phrases in the note: ${antiBrandWords}`
    : "";

  const config = await getPlatformConfig();
  const defaultPrompt = `You are an elite personal brand content strategist. Write ONE concise "AI Strategy Note" (2-3 sentences max) for this creator's upcoming content calendar. It should read like a weekly strategy brief.

The note should explain the balance of content "buckets" for the week: local community content (builds belonging around their city), expert authority (showcases professional expertise), and personal storytelling (human/off-duty moments). Naturally weave in the buckets, format mix, and timing insight.

Calendar starts ${calendar.weekStarting}.

FORMAT MIX:
${Object.entries(formatCounts).map(([fmt, count]) => `- ${fmt}: ${count}`).join("\n")}

BUCKET MIX:
${Object.entries(bucketCounts).map(([bucket, count]) => `- ${bucket}: ${count}`).join("\n")}

UPCOMING DAYS:
${daySummary}${goalBlock}${guardrailBlock}

Respond with ONLY the strategy note text — no headers, no bullet points, no markdown. Keep it under 180 words. Make it feel like a confident strategist wrote it for the creator. Reference the buckets using the exact phrases "local community content", "expert authority", and "personal storytelling" when possible so they can be visually highlighted.`;

  const prompt = (config.calendarStrategyPromptTemplate ?? defaultPrompt)
    .replace(/\{\{weekStarting\}\}/g, calendar.weekStarting)
    .replace(/\{\{formatMix\}\}/g, Object.entries(formatCounts).map(([fmt, count]) => `- ${fmt}: ${count}`).join("\n"))
    .replace(/\{\{bucketMix\}\}/g, Object.entries(bucketCounts).map(([bucket, count]) => `- ${bucket}: ${count}`).join("\n"))
    .replace(/\{\{daySummary\}\}/g, daySummary)
    .replace(/\{\{primaryGoal\}\}/g, primaryGoal ?? "")
    .replace(/\{\{antiBrandWords\}\}/g, antiBrandWords ?? "");

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
        messages: [{ role: "user", content: prompt }],
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

  const calendar = await getWeeklyCalendar();
  if (!calendar) {
    return { success: true, insight: "Generate your first content calendar to get a personalized AI strategy note for the week." };
  }

  const cached = await prisma.analyticsCache.findUnique({
    where: { key: `calendar_strategy_${session.user.id}` },
  });

  const cachedData = cached?.data as { insight?: string; weekStarting?: string } | undefined;
  const isFresh = cached && cached.expiresAt && cached.expiresAt > new Date();
  const matchesWeek = cachedData?.weekStarting === calendar.weekStarting;

  if (cachedData?.insight && isFresh && matchesWeek) {
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

  const answersJson = questionnaire.content;

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

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    console.error("Anthropic API key is not configured");
    return { success: false, error: "API key not configured" };
  }

  const model = await getAnthropicModel();

  const usedTitlesBlock = recentArchived.length > 0
    ? `\n\nPreviously used post titles — do NOT repeat or closely paraphrase any of these:\n${recentArchived.map((p: { title: string }, i: number) => `${i + 1}. ${p.title}`).join("\n")}\n`
    : "";

  const deepDiveBlock = profileSurveys.length > 0
    ? `\n\nThe user has also provided optional deep-dive profile surveys to give you hyper-specific local and personal context. Use these details to make the content highly authentic: ${JSON.stringify(profileSurveys)}`
    : "";

  const answers = answersJson as Record<string, unknown>;
  const primaryGoal = typeof answers.primaryGoal === "string" && answers.primaryGoal ? answers.primaryGoal : null;
  const antiBrandWords = typeof answers.antiBrandWords === "string" && answers.antiBrandWords ? answers.antiBrandWords : null;

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

  const goalBlock = primaryGoal
    ? `\n\nThe user's PRIMARY MARKETING GOAL this month is: "${primaryGoal}". Every piece of content — especially the CTA — should ladder up to this goal.`
    : "";

  const guardrailBlock = antiBrandWords
    ? `\n\nVOCABULARY GUARDRAILS — the user has explicitly banned these words and phrases from ALL content. Do NOT use them anywhere (hook, body, cta, caption, directions): ${antiBrandWords}`
    : "";

  const config = await getPlatformConfig();
  const defaultPrompt = `You are an elite personal brand content strategist. Your job is to help this creator build an audience that follows THEM — the human — not just their business. The best personal brands on social media win because people see a real person with real interests, opinions, and a life outside work. Review these client questionnaire answers: ${JSON.stringify(answersJson)}. ${usedTitlesBlock}${deepDiveBlock}${goalBlock}${guardrailBlock}
Generate a ${daysToPost}-day content calendar starting today, which is ${currentDay}, and running for the next ${daysToPost} consecutive days.

The days must be, in order: ${targetDays.join(", ")}.

The mix must be: ${daysToPost === 1 ? '1 Reel (only one post, make it count)' : daysToPost === 2 ? '1 Reel and 1 Carousel (maximum variety)' : `approx 60% Reels, 30% Carousels, 10% Static posts, but ensure at least one of each format if ${daysToPost} >= 3`}. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

BUCKET DISTRIBUTION — this is the most important balance to get right:
- For ${daysToPost} days, aim for roughly: ${Math.ceil(daysToPost / 3)} Personal, ${Math.ceil(daysToPost / 3)} Expert, ${Math.floor(daysToPost / 3)} Local (adjust by ±1 as needed, but never skip a bucket entirely if days >= 3).
- Personal and Expert posts should be roughly equal. Do NOT let Expert dominate the week.

BUCKET DEFINITIONS — read these carefully:
- "Personal" = genuine off-duty human content. Hobbies, passions, family moments, opinions on life, things they geek out about, who they are when they're NOT working. Do NOT tie Personal posts back to their business or add a work lesson at the end. The post should feel like it could exist even if they had a completely different career.
- "Expert" = professional knowledge, hard-won lessons, industry insights, tips, myth-busting, client stories — their work expertise front and centre. Even Expert posts should feel like they're coming from a real human with personality, not a corporate newsletter.
- "Local" = hyper-local content about their city, community, favourite spots, local events, neighbourhood energy — builds a sense of place and belonging.

Content field definitions:
- "hook": the opening line the creator should say on camera (for Reels) or the headline of the post (for Carousel/Static). This should be copy-pasteable spoken text.
- "body": the full spoken script for Reels, or the main body text for Carousel/Static. This should be copy-pasteable text the creator delivers or writes directly into the post. Do NOT include filming instructions here.
- "directions": filming, performance, or design directions. Tell the creator HOW to make the piece (e.g., shot type, energy, visuals, slide layout). This is NOT copy-pasteable post text.
- "cta": the closing call-to-action the creator should say or write.
- "caption": the social media caption to paste below the post, including hashtags if appropriate.
- "musicSuggestion": music or audio vibe for Reels.
- "duration": target length for Reels (e.g., "45-60 seconds") or read-time estimate for Carousels/Static.

The JSON schema must be:
{
  "weekStarting": "${weekStarting}",
  "days": [
    {
      "day": "${targetDays[0]}",
      "format": "Reel",
      "bucket": "Local",
      "title": "...",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "caption": "...",
      "directions": "...",
      "musicSuggestion": "...",
      "duration": "..."
    }
  ]
}

Days must be one of: ${targetDays.join(", ")}.
Formats must be: Reel, Carousel, Static.
Buckets must be: Personal, Expert, Local.`;

  const prompt = (config.calendarPromptTemplate ?? defaultPrompt)
    .replace(/\{\{questionnaireAnswers\}\}/g, JSON.stringify(answersJson))
    .replace(/\{\{usedTitlesBlock\}\}/g, usedTitlesBlock)
    .replace(/\{\{deepDiveBlock\}\}/g, deepDiveBlock)
    .replace(/\{\{goalBlock\}\}/g, goalBlock)
    .replace(/\{\{guardrailBlock\}\}/g, guardrailBlock)
    .replace(/\{\{daysToPost\}\}/g, String(daysToPost))
    .replace(/\{\{currentDay\}\}/g, currentDay)
    .replace(/\{\{targetDays\}\}/g, targetDays.join(", "))
    .replace(/\{\{formatMix\}\}/g, daysToPost === 1 ? '1 Reel (only one post, make it count)' : daysToPost === 2 ? '1 Reel and 1 Carousel (maximum variety)' : `approx 60% Reels, 30% Carousels, 10% Static posts, but ensure at least one of each format if ${daysToPost} >= 3`)
    .replace(/\{\{bucketDistribution\}\}/g, `- For ${daysToPost} days, aim for roughly: ${Math.ceil(daysToPost / 3)} Personal, ${Math.ceil(daysToPost / 3)} Expert, ${Math.floor(daysToPost / 3)} Local (adjust by ±1 as needed, but never skip a bucket entirely if days >= 3).\n- Personal and Expert posts should be roughly equal. Do NOT let Expert dominate the week.`)
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
        messages: [{ role: "user", content: prompt }],
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

    // Generate AI strategy note for the new calendar in the background
    generateCalendarStrategy(session.user.id).catch((err) =>
      console.error("Background calendar strategy generation failed:", err)
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
