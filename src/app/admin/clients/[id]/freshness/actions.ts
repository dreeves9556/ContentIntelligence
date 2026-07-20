"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  analyzeArchetypes,
  computeFreshnessScore,
  extractThemes,
  analyzeMaterialUsage,
  type ArchivePostForFreshness,
  type QuestionnaireMaterial,
  type ContentArchetype,
} from "@/lib/freshness";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";

export interface FreshnessDebugArchetype {
  archetype: ContentArchetype;
  count: number;
  percentage: number;
}

export interface FreshnessDebugContextStatus {
  surveyType: string;
  title: string;
  status: "current" | "expired" | "missing";
  updatedAt: string | null;
}

export interface FreshnessDebugGenerationLog {
  id: string;
  success: boolean;
  daysGenerated: number | null;
  freshnessScore: number | null;
  archetypeDiversity: number | null;
  themeDiversity: number | null;
  hookSimilarity: number | null;
  stalenessTriggered: boolean;
  audienceFatigueTriggered: boolean;
  dynamicConstraintsMode: string | null;
  dynamicConstraintsFallback: boolean;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
  blockMetadata: {
    included: unknown[];
    trimmed: unknown[];
    omitted: unknown[];
  } | null;
}

export interface FreshnessDebugData {
  user: {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date;
  };
  totalPosts: number;
  generationCount: number;
  freshnessScore: {
    score: number;
    archetypeDiversity: number;
    themeDiversity: number;
    hookSimilarity: number;
  } | null;
  stalenessTriggered: boolean;
  archetypes: FreshnessDebugArchetype[];
  overusedArchetypes: [ContentArchetype, number][];
  underusedArchetypes: ContentArchetype[];
  recentHooks: { title: string; hook: string; weekStarting: string | null }[];
  repeatedThemes: string[];
  materialUsage: { label: string; snippet: string; status: "used" | "fresh" }[];
  untappedMaterial: { label: string; snippet: string }[];
  contextStatus: FreshnessDebugContextStatus[];
  recentLogs: FreshnessDebugGenerationLog[];
}

const CONTEXT_SURVEY_DEFS: { type: string; title: string }[] = [
  { type: "WEEKLY_CONTEXT", title: "Weekly Context" },
  { type: "MONTHLY_CONTEXT", title: "Monthly Context" },
  { type: "STORY_REFRESH", title: "Story Refresh" },
];

function getLastSunday(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function getFirstOfMonth(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

function isContextExpired(surveyType: string, updatedAt: Date): boolean {
  if (surveyType === "WEEKLY_CONTEXT") return updatedAt < getLastSunday();
  if (surveyType === "MONTHLY_CONTEXT") return updatedAt < getFirstOfMonth();
  if (surveyType === "STORY_REFRESH") return updatedAt < new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  return false;
}

export async function getFreshnessDebugData(userId: string): Promise<FreshnessDebugData | null> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  if (!user) return null;

  const [recentArchived, profileSurveys, generationLogs] = await Promise.all([
    prisma.contentArchive.findMany({
      where: { userId },
      orderBy: { archivedAt: "desc" },
      take: 50,
      select: { title: true, hook: true, bucket: true, format: true, weekStarting: true },
    }),
    prisma.profileSurvey.findMany({
      where: { userId },
      select: { surveyType: true, updatedAt: true },
    }),
    prisma.calendarGenerationLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const freshnessPosts: ArchivePostForFreshness[] = recentArchived.map((p) => ({
    title: p.title,
    hook: p.hook,
    bucket: p.bucket,
    format: p.format,
    weekStarting: p.weekStarting,
  }));

  const generationCount = new Set(recentArchived.map((p) => p.weekStarting)).size;

  const freshnessScoreResult = computeFreshnessScore(freshnessPosts);
  const stalenessTriggered = freshnessScoreResult !== null && freshnessScoreResult.score < 50;

  const archetypeAnalysis = analyzeArchetypes(freshnessPosts);
  const archetypes: FreshnessDebugArchetype[] = archetypeAnalysis.sorted.map(([archetype, count]) => ({
    archetype,
    count,
    percentage: archetypeAnalysis.total > 0 ? Math.round((count / archetypeAnalysis.total) * 100) : 0,
  }));

  const recentHooks = freshnessPosts.slice(0, 15).map((p) => ({
    title: p.title,
    hook: p.hook,
    weekStarting: p.weekStarting ?? null,
  }));

  const repeatedThemes = extractThemes(freshnessPosts, 15);

  // Build questionnaire material for usage analysis
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { content: true },
  });

  let materialUsage: { label: string; snippet: string; status: "used" | "fresh" }[] = [];
  let untappedMaterial: { label: string; snippet: string }[] = [];

  if (questionnaire) {
    const answers = questionnaire.content as unknown as QuestionnaireFormData;
    const material: QuestionnaireMaterial[] = [
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
    if (answers.industryAnswers) {
      for (const [key, value] of Object.entries(answers.industryAnswers)) {
        if (typeof value === "string" && value.trim().length > 10) {
          material.push({ label: `Industry: ${key}`, value });
        }
      }
    }

    materialUsage = analyzeMaterialUsage(material, freshnessPosts);
    untappedMaterial = materialUsage.filter((m) => m.status === "fresh");
  }

  // Context survey status
  const contextStatus: FreshnessDebugContextStatus[] = CONTEXT_SURVEY_DEFS.map((def) => {
    const survey = profileSurveys.find((s) => s.surveyType === def.type);
    if (!survey) {
      return { surveyType: def.type, title: def.title, status: "missing", updatedAt: null };
    }
    const expired = isContextExpired(def.type, survey.updatedAt);
    return {
      surveyType: def.type,
      title: def.title,
      status: expired ? "expired" : "current",
      updatedAt: survey.updatedAt.toISOString(),
    };
  });

  const recentLogs: FreshnessDebugGenerationLog[] = generationLogs.map((log) => ({
    id: log.id,
    success: log.success,
    daysGenerated: log.daysGenerated,
    freshnessScore: log.freshnessScore,
    archetypeDiversity: log.archetypeDiversity,
    themeDiversity: log.themeDiversity,
    hookSimilarity: log.hookSimilarity,
    stalenessTriggered: log.stalenessTriggered,
    audienceFatigueTriggered: log.audienceFatigueTriggered,
    dynamicConstraintsMode: log.dynamicConstraintsMode,
    dynamicConstraintsFallback: log.dynamicConstraintsFallback,
    errorMessage: log.errorMessage,
    durationMs: log.durationMs,
    createdAt: log.createdAt.toISOString(),
    blockMetadata: (log.blockMetadata as FreshnessDebugGenerationLog["blockMetadata"]) ?? null,
  }));

  return {
    user,
    totalPosts: freshnessPosts.length,
    generationCount,
    freshnessScore: freshnessScoreResult,
    stalenessTriggered,
    archetypes,
    overusedArchetypes: archetypeAnalysis.overused,
    underusedArchetypes: archetypeAnalysis.underused,
    recentHooks,
    repeatedThemes,
    materialUsage,
    untappedMaterial,
    contextStatus,
    recentLogs,
  };
}
