import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, User, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getUserWithQuestionnaires(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      questionnaires: {
        orderBy: {
          createdAt: "desc",
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

function renderValue(value: any): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[#787878] italic">Not answered</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[#787878] italic">None selected</span>;
    return (
      <ul className="space-y-1">
        {value.map((item, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#c8952a] rounded-full" />
            <span className="text-[#e8e8e8]">{String(item)}</span>
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
      <div className="space-y-3 pl-4 border-l-2 border-[#2a2a2a]">
        {Object.entries(value).map(([subKey, subValue]) => (
          <div key={subKey}>
            <span className="text-xs text-[#787878] uppercase tracking-wider">{formatLabel(subKey)}</span>
            <div className="mt-1">{renderValue(subValue)}</div>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-[#e8e8e8]">{String(value)}</span>;
}

function QuestionnaireAnswers({ content }: { content: any }) {
  if (!content || typeof content !== "object") {
    return (
      <div className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
        <pre className="text-sm text-[#e8e8e8] overflow-x-auto whitespace-pre-wrap">
          {JSON.stringify(content, null, 2)}
        </pre>
      </div>
    );
  }

  const entries = Object.entries(content);

  return (
    <div className="space-y-4">
      {entries.map(([key, value]) => (
        <div key={key} className="bg-[#0a0a0a] rounded-lg p-4 border border-[#1a1a1a]">
          <h5 className="text-xs font-medium text-[#c8952a] uppercase tracking-wider mb-2">
            {formatLabel(key)}
          </h5>
          <div className="mt-1">{renderValue(value)}</div>
        </div>
      ))}
    </div>
  );
}

function QuestionnaireCard({ questionnaire }: { questionnaire: any }) {
  // Parse the JSON content if it's a string, otherwise use as-is
  const content = typeof questionnaire.content === "string" 
    ? JSON.parse(questionnaire.content) 
    : questionnaire.content;

  return (
    <div className="bg-[#111111] rounded-lg border border-[#1a1a1a] overflow-hidden">
      <div className="p-6 border-b border-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
            {questionnaire.title}
          </h3>
          <span className="text-xs text-[#787878]">
            {format(new Date(questionnaire.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
        {questionnaire.description && (
          <p className="text-sm text-[#787878] mt-1">{questionnaire.description}</p>
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
        <h4 className="text-sm font-medium text-[#c8952a] mb-4 uppercase tracking-wider">
          Questionnaire Answers
        </h4>
        <QuestionnaireAnswers content={content} />
      </div>
    </div>
  );
}

export default async function ClientQuestionnairesPage({ params }: PageProps) {
  const { id } = await params;
  const user = await getUserWithQuestionnaires(id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-[#787878] hover:text-[#e8e8e8] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Client Roster
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <div className="h-16 w-16 bg-[#c8952a]/10 rounded-full flex items-center justify-center text-[#c8952a] text-xl font-medium">
          {user.name?.split(" ").map((n) => n[0]).join("") || user.email?.[0]?.toUpperCase() || "?"}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
            {user.name || "Unnamed User"}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-[#787878]">
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
        <div className="bg-[#111111] rounded-lg p-4 border border-[#1a1a1a]">
          <p className="text-sm text-[#787878]">Total Questionnaires</p>
          <p className="text-2xl font-bold text-[#e8e8e8] mt-1">{user.questionnaires.length}</p>
        </div>
        <div className="bg-[#111111] rounded-lg p-4 border border-[#1a1a1a]">
          <p className="text-sm text-[#787878]">Published</p>
          <p className="text-2xl font-bold text-[#e8e8e8] mt-1">
            {user.questionnaires.filter((q) => q.isPublished).length}
          </p>
        </div>
        <div className="bg-[#111111] rounded-lg p-4 border border-[#1a1a1a]">
          <p className="text-sm text-[#787878]">Drafts</p>
          <p className="text-2xl font-bold text-[#e8e8e8] mt-1">
            {user.questionnaires.filter((q) => !q.isPublished).length}
          </p>
        </div>
      </div>

      {/* Questionnaires List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[#e8e8e8]" style={{ fontFamily: "var(--font-playfair)" }}>
          Questionnaires
        </h2>

        {user.questionnaires.length === 0 ? (
          <div className="bg-[#111111] rounded-lg p-12 border border-[#1a1a1a] text-center">
            <FileText className="h-12 w-12 text-[#2a2a2a] mx-auto mb-4" />
            <p className="text-[#787878]">No questionnaires found for this user</p>
          </div>
        ) : (
          <div className="space-y-6">
            {user.questionnaires.map((questionnaire) => (
              <QuestionnaireCard key={questionnaire.id} questionnaire={questionnaire} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
