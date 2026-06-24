import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Settings, ClipboardList } from "lucide-react";
import Link from "next/link";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import SettingsForm from "./SettingsForm";

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
  contentSample: "",
  signaturePhrases: "",
  brandWords: "",
  currentOffer: "",
  preferredCTA: "",
  speakingStyle: "",
  humorStyle: "",
  profanityComfort: "",
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
    contentSample: typeof r.contentSample === "string" ? r.contentSample : DEFAULT_FORM_DATA.contentSample,
    signaturePhrases: typeof r.signaturePhrases === "string" ? r.signaturePhrases : DEFAULT_FORM_DATA.signaturePhrases,
    brandWords: typeof r.brandWords === "string" ? r.brandWords : DEFAULT_FORM_DATA.brandWords,
    currentOffer: typeof r.currentOffer === "string" ? r.currentOffer : DEFAULT_FORM_DATA.currentOffer,
    preferredCTA: typeof r.preferredCTA === "string" ? r.preferredCTA : DEFAULT_FORM_DATA.preferredCTA,
    speakingStyle: typeof r.speakingStyle === "string" ? r.speakingStyle : DEFAULT_FORM_DATA.speakingStyle,
    humorStyle: typeof r.humorStyle === "string" ? r.humorStyle : DEFAULT_FORM_DATA.humorStyle,
    profanityComfort: typeof r.profanityComfort === "string" ? r.profanityComfort : DEFAULT_FORM_DATA.profanityComfort,
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

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, content: true, updatedAt: true },
  });

  if (!questionnaire) {
    return (
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Brand Settings
          </h1>
          <p className="text-text-muted mt-1">Manage your brand parameters and content preferences.</p>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-6">
          <div className="p-5 bg-accent-primary/10 rounded-full">
            <ClipboardList className="h-10 w-10 text-accent-primary" />
          </div>
          <div className="space-y-2">
            <h2
              className="text-2xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              No Brand Profile Yet
            </h2>
            <p className="text-text-muted max-w-md">
              Complete the onboarding questionnaire first to set up your brand profile. Once submitted,
              you can edit all your answers here.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            <ClipboardList className="h-4 w-4" />
            Complete Onboarding
          </Link>
        </div>
      </div>
    );
  }

  const formData = mergeWithDefaults(questionnaire.content);

  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(questionnaire.updatedAt));

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Brand Settings
          </h1>
          <p className="text-text-muted mt-1">
            Update your brand parameters — changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-background-card rounded-lg border border-background-secondary shrink-0">
          <Settings className="h-4 w-4 text-accent-primary" />
          <span className="text-xs text-text-muted">Last saved:</span>
          <span className="text-xs text-text-primary font-medium">{lastUpdated}</span>
        </div>
      </div>

      {/* Form */}
      <SettingsForm questionnaireId={questionnaire.id} initialData={formData} />
    </div>
  );
}
