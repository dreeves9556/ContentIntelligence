import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, User, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SURVEY_TYPE_TITLES: Record<string, string> = {
  LOCAL_MAYOR: "The Local Mayor",
  TRENCH_WARFARE: "Trench Warfare",
  ORIGIN_STORY: "Origin Story",
  CLIENT_AVATAR: "Client Avatar",
  OFFER_FUNNEL: "Offer & Funnel",
  PROOF_BANK: "Proof Bank",
  COMPLIANCE_GUARDRAILS: "Compliance & Brand Safety",
};

async function getUserWithSurveys(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      questionnaires: {
        orderBy: {
          createdAt: "desc",
        },
      },
      profileSurveys: {
        orderBy: {
          updatedAt: "desc",
        },
      },
    },
  });

  return user;
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .replace(/_/g, " ");
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-text-muted italic">Not answered</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-text-muted italic">None selected</span>;
    return (
      <ul className="space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent-primary rounded-full" />
            <span className="text-text-primary">{String(item)}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className={`font-medium ${value ? "text-emerald-400" : "text-amber-400"}`}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (typeof value === "object") {
    return (
      <div className="space-y-3 pl-4 border-l-2 border-border-primary">
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey}>
            <span className="text-xs text-text-muted uppercase tracking-wider">{formatLabel(subKey)}</span>
            <div className="mt-1">{renderValue(subValue)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-text-primary">{String(value)}</span>;
}

function QuestionnaireAnswers({ content }: { content: unknown }) {
  if (!content || typeof content !== "object") {
    return (
      <div className="bg-background-secondary rounded-lg p-4 border border-border-primary">
        <pre className="text-sm text-text-primary overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  const entries = Object.entries(content);

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <div key={key} className="bg-background-secondary rounded-lg p-4 border border-border-primary">
          <h5 className="text-xs font-medium text-accent-primary uppercase tracking-wider mb-2">
            {formatLabel(key)}
          </h5>
          <div className="mt-1">{renderValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

type UserWithSurveys = NonNullable<Awaited<ReturnType<typeof getUserWithSurveys>>>;
type QuestionnaireRecord = UserWithSurveys["questionnaires"][number];
type ProfileSurveyRecord = UserWithSurveys["profileSurveys"][number];

function QuestionnaireCard({ questionnaire }: { questionnaire: QuestionnaireRecord }) {
  // Parse the JSON content if it's a string, otherwise use as-is
  const content = typeof questionnaire.content === "string" 
    ? JSON.parse(questionnaire.content) 
    : questionnaire.content;

  return (
    <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
      <div className="p-6 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {questionnaire.title}
          </h3>
          <span className="text-xs text-text-muted">
            {format(new Date(questionnaire.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        {questionnaire.description && (
          <p className="text-sm text-text-muted mt-1">{questionnaire.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              questionnaire.isPublished
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            }`}
          >
            {questionnaire.isPublished ? "Published" : "Draft"}
          </span>
        </div>
      </div>

      <div className="p-6">
        <h4 className="text-sm font-medium text-accent-primary mb-4 uppercase tracking-wider">
          Questionnaire Answers
        </h4>
        <QuestionnaireAnswers content={content} />
      </div>
    </div>
  );
}

function ProfileSurveyCard({ survey }: { survey: ProfileSurveyRecord }) {
  const answers = typeof survey.answersJson === "string"
    ? JSON.parse(survey.answersJson)
    : survey.answersJson;
  const title = SURVEY_TYPE_TITLES[survey.surveyType] ?? survey.surveyType;

  return (
    <div className="bg-background-card rounded-lg border border-border-primary overflow-hidden">
      <div className="p-6 border-b border-border-primary">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {title}
          </h3>
          <span className="text-xs text-text-muted">
            {format(new Date(survey.updatedAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
            Deep-Dive Survey
          </span>
        </div>
      </div>

      <div className="p-6">
        <h4 className="text-sm font-medium text-accent-primary mb-4 uppercase tracking-wider">
          Survey Answers
        </h4>
        <QuestionnaireAnswers content={answers} />
      </div>
    </div>
  );
}

export default async function ClientQuestionnairesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserWithSurveys(id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Client Roster
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="h-16 w-16 bg-accent-primary/10 rounded-full flex items-center justify-center text-accent-primary text-xl font-medium">
          {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
            {user.name || "Unnamed User"}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-text-muted">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {user.email}
            </span>
            <span className="text-[#2a2a2a]">|</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              Joined {format(user.createdAt, "MMM d, yyyy")}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-sm text-text-muted">Onboarding Questionnaires</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{user.questionnaires.length}</p>
        </div>
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-sm text-text-muted">Deep-Dive Surveys</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{user.profileSurveys.length}</p>
        </div>
        <div className="bg-background-card rounded-lg p-4 border border-border-primary">
          <p className="text-sm text-text-muted">Total Surveys</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{user.questionnaires.length + user.profileSurveys.length}</p>
        </div>
      </div>

      {/* Onboarding Questionnaires */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Onboarding Questionnaires
        </h2>

        {user.questionnaires.length === 0 ? (
          <div className="bg-background-card rounded-lg p-12 border border-border-primary text-center">
            <FileText className="h-12 w-12 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-text-muted">No onboarding questionnaires found for this user</p>
          </div>
        ) : (
          <div className="space-y-6">
            {user.questionnaires.map((questionnaire) => (
              <QuestionnaireCard key={questionnaire.id} questionnaire={questionnaire} />
            ))}
          </div>
        )}
      </div>

      {/* Deep-Dive Surveys */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Deep-Dive Surveys
        </h2>

        {user.profileSurveys.length === 0 ? (
          <div className="bg-background-card rounded-lg p-12 border border-border-primary text-center">
            <FileText className="h-12 w-12 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-text-muted">No deep-dive surveys found for this user</p>
          </div>
        ) : (
          <div className="space-y-6">
            {user.profileSurveys.map((survey) => (
              <ProfileSurveyCard key={survey.id} survey={survey} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
