"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY is not set");
    return { success: false, error: "API key not configured" };
  }

  const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  const usedTitlesBlock = recentArchived.length > 0
    ? `\n\nPreviously used post titles — do NOT repeat or closely paraphrase any of these:\n${recentArchived.map((p: { title: string }, i: number) => `${i + 1}. ${p.title}`).join("\n")}\n`
    : "";

  const deepDiveBlock = profileSurveys.length > 0
    ? `\n\nThe user has also provided optional deep-dive profile surveys to give you hyper-specific local and personal context. Use these details to make the content highly authentic: ${JSON.stringify(profileSurveys)}`
    : "";

  const answers = answersJson as Record<string, unknown>;
  const primaryGoal = typeof answers.primaryGoal === "string" && answers.primaryGoal ? answers.primaryGoal : null;
  const antiBrandWords = typeof answers.antiBrandWords === "string" && answers.antiBrandWords ? answers.antiBrandWords : null;

  const goalBlock = primaryGoal
    ? `\n\nThe user's PRIMARY MARKETING GOAL this month is: "${primaryGoal}". Every piece of content — especially the CTA — should ladder up to this goal.`
    : "";

  const guardrailBlock = antiBrandWords
    ? `\n\nVOCABULARY GUARDRAILS — the user has explicitly banned these words and phrases from ALL content. Do NOT use them anywhere (hook, body, cta, caption, directions): ${antiBrandWords}`
    : "";

  const prompt = `You are an elite real estate and personal brand content strategist. Review these client questionnaire answers: ${JSON.stringify(answersJson)}. ${usedTitlesBlock}${deepDiveBlock}${goalBlock}${guardrailBlock}
Generate a 7-day content calendar starting today, which is ${currentDay}, and running for the next 7 consecutive days.

The mix must be approx 60% Reels, 30% Carousels, 10% Static posts. Include Personal, Expert, and Local buckets. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

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
  "weekStarting": "2026-06-16",
  "days": [
    {
      "day": "MONDAY",
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

Days must be: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY.
Formats must be: Reel, Carousel, Static.
Buckets must be: Personal, Expert, Local.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-8",
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

    revalidatePath("/dashboard/calendar");
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
