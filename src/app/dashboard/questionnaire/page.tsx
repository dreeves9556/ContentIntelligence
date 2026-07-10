import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserMemories } from "@/lib/memory/memory-service";
import { MEMORY_TYPE_LABELS, MEMORY_TYPE_DESCRIPTIONS } from "@/lib/memory/memory-types";
import type { MemoryType } from "@prisma/client";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import QuestionnaireClient from "./QuestionnaireClient";

export const dynamic = "force-dynamic";

const DEFAULT_FORM_DATA: QuestionnaireFormData = {
  name: "",
  businessName: "",
  city: "",
  whatYouDo: "",
  industry: "",
  brandType: "",
  personalStory: "",
  industryAnswers: {},
  onCameraPersonality: [],
  contentEnjoyed: [],
  daysToPost: 3,
  primaryGoal: "",
  antiBrandWords: "",
  numbersThatImpress: "",
  recentWin: "",
  faqTop3: "",
  seasonalRhythm: "",
  upcomingEvents: "",
  contentSample: "",
  signaturePhrases: "",
  brandWords: "",
  currentOffer: "",
  preferredCTA: "",
  speakingStyle: "",
  humorStyle: "",
  sentenceLength: "",
  audienceLabel: "",
  clientWords: "",
  contentBoundaries: "",
  familyContext: "",
  morningRoutine: "",
  hotTakes: "",
  emojiUsage: "",
  formattingStyle: "",
  storytellingStyle: "",
};

function mergeWithDefaults(raw: unknown): QuestionnaireFormData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_FORM_DATA;
  }
  const r = raw as Record<string, unknown>;
  return {
    name: typeof r.name === "string" ? r.name : DEFAULT_FORM_DATA.name,
    businessName: typeof r.businessName === "string" ? r.businessName : DEFAULT_FORM_DATA.businessName,
    city: typeof r.city === "string" ? r.city : DEFAULT_FORM_DATA.city,
    whatYouDo: typeof r.whatYouDo === "string" ? r.whatYouDo : DEFAULT_FORM_DATA.whatYouDo,
    industry: typeof r.industry === "string" ? r.industry : DEFAULT_FORM_DATA.industry,
    brandType: typeof r.brandType === "string" ? r.brandType : DEFAULT_FORM_DATA.brandType,
    personalStory: typeof r.personalStory === "string" ? r.personalStory : DEFAULT_FORM_DATA.personalStory,
    industryAnswers:
      r.industryAnswers && typeof r.industryAnswers === "object" && !Array.isArray(r.industryAnswers)
        ? (r.industryAnswers as Record<string, string>)
        : DEFAULT_FORM_DATA.industryAnswers,
    onCameraPersonality: Array.isArray(r.onCameraPersonality)
      ? (r.onCameraPersonality as string[])
      : DEFAULT_FORM_DATA.onCameraPersonality,
    contentEnjoyed: Array.isArray(r.contentEnjoyed)
      ? (r.contentEnjoyed as string[])
      : DEFAULT_FORM_DATA.contentEnjoyed,
    daysToPost: typeof r.daysToPost === "number" ? r.daysToPost : DEFAULT_FORM_DATA.daysToPost,
    primaryGoal: typeof r.primaryGoal === "string" ? r.primaryGoal : DEFAULT_FORM_DATA.primaryGoal,
    antiBrandWords: typeof r.antiBrandWords === "string" ? r.antiBrandWords : DEFAULT_FORM_DATA.antiBrandWords,
    numbersThatImpress: typeof r.numbersThatImpress === "string" ? r.numbersThatImpress : DEFAULT_FORM_DATA.numbersThatImpress,
    recentWin: typeof r.recentWin === "string" ? r.recentWin : DEFAULT_FORM_DATA.recentWin,
    faqTop3: typeof r.faqTop3 === "string" ? r.faqTop3 : DEFAULT_FORM_DATA.faqTop3,
    seasonalRhythm: typeof r.seasonalRhythm === "string" ? r.seasonalRhythm : DEFAULT_FORM_DATA.seasonalRhythm,
    upcomingEvents: typeof r.upcomingEvents === "string" ? r.upcomingEvents : DEFAULT_FORM_DATA.upcomingEvents,
    contentSample: typeof r.contentSample === "string" ? r.contentSample : DEFAULT_FORM_DATA.contentSample,
    signaturePhrases: typeof r.signaturePhrases === "string" ? r.signaturePhrases : DEFAULT_FORM_DATA.signaturePhrases,
    brandWords: typeof r.brandWords === "string" ? r.brandWords : DEFAULT_FORM_DATA.brandWords,
    currentOffer: typeof r.currentOffer === "string" ? r.currentOffer : DEFAULT_FORM_DATA.currentOffer,
    preferredCTA: typeof r.preferredCTA === "string" ? r.preferredCTA : DEFAULT_FORM_DATA.preferredCTA,
    speakingStyle: typeof r.speakingStyle === "string" ? r.speakingStyle : DEFAULT_FORM_DATA.speakingStyle,
    humorStyle: typeof r.humorStyle === "string" ? r.humorStyle : DEFAULT_FORM_DATA.humorStyle,
    sentenceLength: typeof r.sentenceLength === "string" ? r.sentenceLength : DEFAULT_FORM_DATA.sentenceLength,
    audienceLabel: typeof r.audienceLabel === "string" ? r.audienceLabel : DEFAULT_FORM_DATA.audienceLabel,
    clientWords: typeof r.clientWords === "string" ? r.clientWords : DEFAULT_FORM_DATA.clientWords,
    contentBoundaries: typeof r.contentBoundaries === "string" ? r.contentBoundaries : DEFAULT_FORM_DATA.contentBoundaries,
    familyContext: typeof r.familyContext === "string" ? r.familyContext : DEFAULT_FORM_DATA.familyContext,
    morningRoutine: typeof r.morningRoutine === "string" ? r.morningRoutine : DEFAULT_FORM_DATA.morningRoutine,
    hotTakes: typeof r.hotTakes === "string" ? r.hotTakes : DEFAULT_FORM_DATA.hotTakes,
    emojiUsage: typeof r.emojiUsage === "string" ? r.emojiUsage : DEFAULT_FORM_DATA.emojiUsage,
    formattingStyle: typeof r.formattingStyle === "string" ? r.formattingStyle : DEFAULT_FORM_DATA.formattingStyle,
    storytellingStyle: typeof r.storytellingStyle === "string" ? r.storytellingStyle : DEFAULT_FORM_DATA.storytellingStyle,
  };
}

export default async function QuestionnairePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [questionnaire, profileSurveys, memories] = await Promise.all([
    prisma.questionnaire.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, updatedAt: true },
    }),
    prisma.profileSurvey.findMany({
      where: { userId: session.user.id },
      select: { id: true, surveyType: true, answersJson: true, updatedAt: true },
    }),
    getUserMemories(session.user.id),
  ]);

  const grouped = {} as Record<MemoryType, typeof memories>;
  const types: MemoryType[] = ["IDENTITY", "VOICE", "AUDIENCE", "CONTENT", "PERFORMANCE", "STRATEGY", "PREFERENCE", "WARNING"];
  for (const type of types) {
    grouped[type] = memories.filter((m) => m.memoryType === type);
  }

  const formData = questionnaire
    ? mergeWithDefaults(questionnaire.content)
    : null;

  const lastUpdated = questionnaire
    ? new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(questionnaire.updatedAt))
    : null;

  return (
    <QuestionnaireClient
      questionnaire={
        questionnaire
          ? { id: questionnaire.id, formData: formData!, lastUpdated }
          : null
      }
      profileSurveys={profileSurveys.map((s) => ({
        id: s.id,
        surveyType: s.surveyType,
        answersJson: s.answersJson as Record<string, string>,
        updatedAt: s.updatedAt.toISOString(),
      }))}
      groupedMemories={grouped}
      typeLabels={MEMORY_TYPE_LABELS}
      typeDescriptions={MEMORY_TYPE_DESCRIPTIONS}
      memoryStats={{
        total: memories.length,
        pinned: memories.filter((m) => m.pinned).length,
        highConfidence: memories.filter((m) => m.confidence >= 70).length,
      }}
    />
  );
}
