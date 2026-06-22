"use client";

import { useState, useTransition } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Mail,
  Shield,
  LogOut,
  Save,
  Camera,
  Edit2,
  Trash2,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  ClipboardList,
  MapPin,
  Sword,
  BookOpen,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { saveProfileSurvey, deleteProfileSurvey, updateOnboarding } from "./actions";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionnaireData {
  name?: string;
  businessName?: string;
  city?: string;
  whatYouDo?: string;
  industry?: string;
  brandType?: string;
  personalStory?: string;
  hobbies?: string;
  idealClient?: string;
  bestClientCommonalities?: string;
  industryAnswers?: Record<string, string>;
  localSpots?: string;
  communityUniqueness?: string;
  onCameraPersonality?: string[];
  contentEnjoyed?: string[];
  daysToPost?: number;
  [key: string]: unknown;
}

interface ProfileSurveyRecord {
  id: string;
  surveyType: string;
  answersJson: Record<string, string>;
}

interface Props {
  questionnaire: { id: string; content: QuestionnaireData } | null;
  profileSurveys: ProfileSurveyRecord[];
}

// ─── Survey definitions ───────────────────────────────────────────────────────

interface SurveyField {
  key: string;
  label: string;
  placeholder: string;
}

interface SurveyDef {
  type: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  fields: SurveyField[];
}

const TRENCH_WARFARE_WILDEST_LABEL: Record<string, string> = {
  "Real Estate": "Wildest thing you've seen at an inspection or closing?",
  "Fitness / Personal Training": "Wildest thing you've seen in a gym or training session?",
  "Financial Services": "Wildest thing you've seen in a client's portfolio or tax audit?",
  "Coaching / Consulting": "Wildest thing you've uncovered during a client discovery call?",
  Other: "Wildest thing you've uncovered during a client discovery call?",
};

const ORIGIN_STORY_PETPEEVE_LABEL: Record<string, string> = {
  "Real Estate": "Your biggest pet peeve about other agents?",
  "Fitness / Personal Training": "Your biggest pet peeve about other trainers or influencers?",
  "Financial Services": "Your biggest pet peeve about other advisors?",
  "Coaching / Consulting": "Your biggest pet peeve about others in your industry?",
  Other: "Your biggest pet peeve about others in your industry?",
};

const SURVEYS: SurveyDef[] = [
  {
    type: "LOCAL_MAYOR",
    title: "The Local Mayor",
    subtitle: "Hyper-local knowledge that sets you apart from every out-of-town agent.",
    icon: MapPin,
    color: "#3b82f6",
    fields: [
      { key: "hiddenGems", label: "Top 3 hidden gem businesses in your market?", placeholder: "The coffee shop no tourists know about, the family-run hardware store..." },
      { key: "fierceDebate", label: "The most fiercely debated local topic right now?", placeholder: "The new development going up downtown, the school rezoning..." },
      { key: "idealSunday", label: "Your ideal unplugged Sunday in your city?", placeholder: "Farmer's market, hike at Runyon, brunch at..." },
      { key: "underratedNeighborhood", label: "The most underrated neighborhood that will boom in 5 years?", placeholder: "And why you believe that..." },
    ],
  },
  {
    type: "TRENCH_WARFARE",
    title: "Trench Warfare",
    subtitle: "Battle-tested wisdom from the deals only real agents survive.",
    icon: Sword,
    color: "#ef4444",
    fields: [
      { key: "wildestStory", label: "Wildest thing you've seen at an inspection or closing?", placeholder: "The story that still makes you shake your head..." },
      { key: "disagreesWith", label: "Common real estate advice you publicly disagree with?", placeholder: "The myth you push back on at every dinner party..." },
      { key: "negotiationStyle", label: "Your negotiation style in 3 words?", placeholder: "e.g. Patient, Strategic, Relentless" },
      { key: "mostCommonDM", label: "What's the #1 question you get in your DMs?", placeholder: "The question you answer so often you could do it in your sleep..." },
      { key: "trophyRoomWin", label: "The Trophy Room: A recent 'miracle' or massive win you pulled off for a client that seemed impossible?", placeholder: "The deal everyone said couldn't be done..." },
      { key: "objectionCrusher", label: "The Objection Crusher: Most common reason a prospect says 'no' or 'I want to wait', and how you respond?", placeholder: "The hesitation you've heard a hundred times, and exactly how you handle it..." },
    ],
  },
  {
    type: "ORIGIN_STORY",
    title: "Origin Story",
    subtitle: "The authentic backstory that makes followers root for you.",
    icon: BookOpen,
    color: "#a855f7",
    fields: [
      { key: "yearOneFailure", label: "Your biggest failure in year 1 and the lesson it taught you?", placeholder: "The deal that fell apart, the client you lost, and what changed after..." },
      { key: "agentPetPeeve", label: "Your biggest pet peeve about other agents?", placeholder: "The thing that makes you cringe when you see it..." },
      { key: "geekHobby", label: "A hobby or interest you absolutely geek out about?", placeholder: "The thing your friends tease you for knowing too much about..." },
      { key: "alternativeCareer", label: "If not in this industry, what career would you have pursued?", placeholder: "Your alternate universe..." },
    ],
  },
  {
    type: "CLIENT_AVATAR",
    title: "Client Avatar",
    subtitle: "Know your people deeply — attract more of the right ones.",
    icon: Users,
    color: "#10b981",
    fields: [
      { key: "favoriteClientType", label: "Describe your absolute favourite type of client to work with?", placeholder: "Not just demographics — what's their energy, attitude, situation?" },
      { key: "clientBiggestFear", label: "What is the single biggest fear your ideal client has?", placeholder: "The thing that keeps them awake at 2am before signing..." },
      { key: "clientRedFlag", label: "A red flag that tells you to politely walk away from a client?", placeholder: "The moment you know it's not a good fit..." },
    ],
  },
];

// ─── Onboarding display fields ────────────────────────────────────────────────

const ONBOARDING_DISPLAY: { key: string; label: string }[] = [
  { key: "name", label: "Your Name" },
  { key: "businessName", label: "Business Name" },
  { key: "city", label: "City / Market" },
  { key: "whatYouDo", label: "What You Do" },
  { key: "industry", label: "Industry" },
  { key: "brandType", label: "Brand Type" },
  { key: "personalStory", label: "Personal Story" },
  { key: "primaryGoal", label: "Primary Marketing Goal" },
  { key: "antiBrandWords", label: "Banned Words & Phrases" },
];

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm resize-none";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#111111] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between p-6 border-b border-white/10 bg-[#111111]">
          <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
            {title}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-muted hover:text-white hover:bg-white/10 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function StatusBanner({ status, error }: { status: "success" | "error" | null; error?: string }) {
  if (!status) return null;
  if (status === "success") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Saved successfully.
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
      <AlertCircle className="h-4 w-4 shrink-0" />
      {error || "Something went wrong."}
    </div>
  );
}

// ─── Onboarding Edit Modal ────────────────────────────────────────────────────

function OnboardingEditModal({
  initialData,
  onClose,
}: {
  initialData: QuestionnaireData;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<QuestionnaireData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const set = (key: string, value: unknown) => setFormData((p) => ({ ...p, [key]: value }));

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateOnboarding(formData);
      if (result.success) {
        setStatus("success");
        setTimeout(() => onClose(), 1200);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  const textFields: { key: string; label: string; placeholder: string; rows?: number }[] = [
    { key: "name", label: "Your Name", placeholder: "Jane Smith" },
    { key: "businessName", label: "Business Name", placeholder: "Smith Realty Group" },
    { key: "city", label: "City / Market", placeholder: "Miami, FL" },
    { key: "whatYouDo", label: "What You Do", placeholder: "Describe your work...", rows: 3 },
    { key: "personalStory", label: "Personal Story", placeholder: "Share your journey...", rows: 4 },
  ];

  const PRIMARY_GOAL_OPTIONS = [
    "Brand Awareness",
    "Lead Generation",
    "Event/Webinar Signups",
    "Recruitment/Partnerships",
    "Education/Authority",
  ];

  return (
    <Modal title="Edit Core Foundation" onClose={onClose}>
      <div className="space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        {textFields.map(({ key, label, placeholder, rows = 2 }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{label}</label>
            <textarea
              rows={rows}
              placeholder={placeholder}
              value={typeof formData[key] === "string" ? (formData[key] as string) : ""}
              onChange={(e) => set(key, e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Primary marketing goal this month</label>
          <select
            value={typeof formData.primaryGoal === "string" ? formData.primaryGoal : ""}
            onChange={(e) => set("primaryGoal", e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>Select your goal...</option>
            {PRIMARY_GOAL_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Words or phrases the AI should NEVER use</label>
          <textarea
            rows={3}
            placeholder={`e.g. "hustle", "dream home", "boss babe" — anything that feels off-brand to you`}
            value={typeof formData.antiBrandWords === "string" ? formData.antiBrandWords : ""}
            onChange={(e) => set("antiBrandWords", e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-text-muted border border-white/10 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Survey Modal ─────────────────────────────────────────────────────────────

function SurveyModal({
  survey,
  initialAnswers,
  onClose,
}: {
  survey: SurveyDef;
  initialAnswers: Record<string, string>;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProfileSurvey(survey.type, answers);
      if (result.success) {
        setStatus("success");
        setTimeout(() => onClose(), 1200);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  return (
    <Modal title={survey.title} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm text-text-muted">{survey.subtitle}</p>
        <StatusBanner status={status} error={errorMsg} />
        {survey.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-text-primary mb-1.5">{field.label}</label>
            <textarea
              rows={3}
              placeholder={field.placeholder}
              value={answers[field.key] ?? ""}
              onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
              className={inputClass}
            />
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-lg text-sm text-text-muted border border-white/10 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold disabled:opacity-60 hover:opacity-90 transition-opacity"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            <Save className="h-4 w-4" />
            {isPending ? "Saving…" : "Save Survey"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Survey Card ──────────────────────────────────────────────────────────────

function SurveyCard({
  survey,
  existing,
  industry,
}: {
  survey: SurveyDef;
  existing: ProfileSurveyRecord | undefined;
  industry?: string;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [deleteStatus, setDeleteStatus] = useState<"error" | null>(null);

  const Icon = survey.icon;
  const isCompleted = !!existing;

  const resolvedFields = survey.fields.map((f) => {
    if (survey.type === "TRENCH_WARFARE" && f.key === "wildestStory" && industry) {
      return { ...f, label: TRENCH_WARFARE_WILDEST_LABEL[industry] ?? f.label };
    }
    if (survey.type === "ORIGIN_STORY" && f.key === "agentPetPeeve" && industry) {
      return { ...f, label: ORIGIN_STORY_PETPEEVE_LABEL[industry] ?? f.label };
    }
    return f;
  });

  const handleDelete = () => {
    if (!confirm(`Clear your "${survey.title}" survey? This cannot be undone.`)) return;
    startTransition(async () => {
      const result = await deleteProfileSurvey(survey.type);
      if (!result.success) setDeleteStatus("error");
    });
  };

  return (
    <>
      <div className="rounded-2xl border border-white/7 bg-[#111111] p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ background: `${survey.color}20` }}>
              <Icon className="h-5 w-5" style={{ color: survey.color }} />
            </div>
            <div>
              <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                {survey.title}
              </h3>
              <p className="text-xs text-text-muted mt-0.5">{survey.subtitle}</p>
            </div>
          </div>
          {isCompleted ? (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
              Completed
            </span>
          ) : (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-text-muted border border-white/10">
              Not started
            </span>
          )}
        </div>

        {isCompleted && existing ? (
          <div className="space-y-3">
            {resolvedFields.map((field) => {
              const answer = existing.answersJson[field.key];
              if (!answer) return null;
              return (
                <div key={field.key} className="space-y-1">
                  <p className="text-xs font-medium text-text-muted">{field.label}</p>
                  <p className="text-sm text-text-primary leading-relaxed bg-background-secondary/50 rounded-lg px-3 py-2 border border-white/5">
                    {answer}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">
            Complete this survey to give the AI hyper-specific context for your content.
          </p>
        )}

        {deleteStatus === "error" && (
          <p className="text-xs text-red-400">Failed to delete. Please try again.</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            {isCompleted ? <Edit2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isCompleted ? "Edit" : "Start Survey"}
          </button>
          {isCompleted && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isPending ? "Clearing…" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {modalOpen && (
        <SurveyModal
          survey={{ ...survey, fields: resolvedFields }}
          initialAnswers={existing?.answersJson ?? {}}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ─── Core Foundation Card ─────────────────────────────────────────────────────

function CoreFoundationCard({ questionnaire }: { questionnaire: { id: string; content: QuestionnaireData } | null }) {
  const [editOpen, setEditOpen] = useState(false);
  const content = questionnaire?.content ?? {};

  return (
    <>
      <div className="rounded-2xl border border-white/7 bg-[#111111] p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-accent-primary/20">
              <ClipboardList className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
                The Core Foundation
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Your original onboarding answers — the backbone of your brand voice.</p>
            </div>
          </div>
          {questionnaire ? (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
              Completed
            </span>
          ) : (
            <span className="shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Incomplete
            </span>
          )}
        </div>

        {questionnaire ? (
          <div className="space-y-3">
            {ONBOARDING_DISPLAY.map(({ key, label }) => {
              const val = content[key];
              if (!val || (typeof val === "string" && val.trim() === "")) return null;
              return (
                <div key={key} className="space-y-1">
                  <p className="text-xs font-medium text-text-muted">{label}</p>
                  <p className="text-sm text-text-primary leading-relaxed bg-background-secondary/50 rounded-lg px-3 py-2 border border-white/5">
                    {Array.isArray(val) ? val.join(", ") : String(val)}
                  </p>
                </div>
              );
            })}
            {Array.isArray(content.onCameraPersonality) && content.onCameraPersonality.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted">On-Camera Personality</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.onCameraPersonality.map((p: string) => (
                    <span key={p} className="px-2.5 py-1 text-xs rounded-full bg-accent-primary/15 text-accent-primary border border-accent-primary/20">{p}</span>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(content.contentEnjoyed) && content.contentEnjoyed.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-text-muted">Content Formats</p>
                <div className="flex flex-wrap gap-1.5">
                  {content.contentEnjoyed.map((p: string) => (
                    <span key={p} className="px-2.5 py-1 text-xs rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-text-muted italic">You haven't completed onboarding yet. Visit the onboarding flow to get started.</p>
        )}

        {questionnaire && (
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-90"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Answers
          </button>
        )}
      </div>

      {editOpen && questionnaire && (
        <OnboardingEditModal
          initialData={questionnaire.content}
          onClose={() => setEditOpen(false)}
        />
      )}
    </>
  );
}

// ─── Account Card ─────────────────────────────────────────────────────────────

function AccountCard() {
  const { data: session, update } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(session?.user?.name ?? "");
  const [message, setMessage] = useState<string | null>(null);

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        await update();
        setMessage("Profile updated successfully");
        setIsEditing(false);
      } else {
        setMessage("Failed to update profile");
      }
    } catch {
      setMessage("An error occurred");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/7 bg-[#111111] p-6 space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          {session?.user?.image ? (
            <img src={session.user.image} alt={session.user.name ?? "Profile"} className="h-20 w-20 rounded-full object-cover border-2 border-accent-primary" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-accent-primary/20 flex items-center justify-center text-xl font-bold text-accent-primary border-2 border-accent-primary">
              {initials}
            </div>
          )}
          <button className="absolute bottom-0 right-0 p-1.5 bg-background-secondary rounded-full border border-background-primary hover:bg-background-primary transition-colors">
            <Camera className="h-3.5 w-3.5 text-text-muted" />
          </button>
        </div>
        <h2 className="text-lg font-semibold text-white" style={{ fontFamily: "var(--font-playfair)" }}>
          {session?.user?.name ?? "Anonymous"}
        </h2>
        <p className="text-text-muted text-sm">{session?.user?.email}</p>
        <span className="mt-2 px-3 py-1 bg-accent-primary/10 text-accent-primary text-xs rounded-full uppercase tracking-wider">
          {session?.user?.role ?? "User"}
        </span>
      </div>

      <div className="border-t border-white/7 pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Account Info</h3>
          <Button variant="outline" size="sm" onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving} className="border-accent-primary text-accent-primary hover:bg-accent-primary/10 text-xs">
            {isSaving ? "Saving…" : isEditing ? <><Save className="h-3 w-3 mr-1" />Save</> : <><Edit2 className="h-3 w-3 mr-1" />Edit</>}
          </Button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-xs ${message.includes("success") ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
            {message}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-text-muted shrink-0" />
            {isEditing ? (
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 px-3 py-1.5 bg-background-secondary border border-white/10 rounded-md text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/50" />
            ) : (
              <span className="text-sm text-text-primary">{session?.user?.name ?? "Not set"}</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-text-muted shrink-0" />
            <span className="text-sm text-text-primary">{session?.user?.email}</span>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-text-muted shrink-0" />
            <span className="text-sm text-text-primary">{session?.user?.role ?? "User"}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/7 pt-5">
        <Button variant="outline" onClick={() => signOut({ callbackUrl: "/login" })} className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm">
          <LogOut className="h-4 w-4 mr-2" />Sign Out
        </Button>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ProfileDashboardClient({ questionnaire, profileSurveys }: Props) {
  const completedCount = profileSurveys.length;
  const totalSurveys = SURVEYS.length;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
          Profile &amp; AI Context
        </h1>
        <p className="text-text-muted" style={{ fontFamily: "var(--font-dm-sans)" }}>
          The more you share, the smarter your AI content becomes.{" "}
          <span className="text-accent-primary font-medium">{completedCount}/{totalSurveys} deep dives complete.</span>
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl bg-[#111111] border border-white/7 p-5 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-white">AI Context Strength</span>
          <span className="text-text-muted">{Math.round(((completedCount + (questionnaire ? 1 : 0)) / (totalSurveys + 1)) * 100)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-background-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.round(((completedCount + (questionnaire ? 1 : 0)) / (totalSurveys + 1)) * 100)}%`,
              background: "#c8952a",
            }}
          />
        </div>
        <p className="text-xs text-text-muted">Complete all sections to unlock maximum AI personalisation for your content calendar.</p>
      </div>

      {/* Two-column layout on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Account */}
        <div className="lg:col-span-1 space-y-6">
          <AccountCard />
          <PushNotificationManager />
        </div>

        {/* Right column — Profile surveys */}
        <div className="lg:col-span-2 space-y-6">
          <CoreFoundationCard questionnaire={questionnaire} />

          {/* Deep Dive intro callout */}
          <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-5 py-4 space-y-1">
            <p className="text-sm font-semibold text-accent-primary">The more you put in, the more bespoke your posts become.</p>
            <p className="text-sm text-text-muted leading-relaxed">
              Each Deep Dive survey below feeds the AI hyper-specific details about your personality, market, and clients that no generic tool will ever have. A half-filled answer still helps — but the agents who complete every section get posts that sound like <em>them</em>, not like a template.
            </p>
          </div>

          {SURVEYS.map((survey) => (
            <SurveyCard
              key={survey.type}
              survey={survey}
              existing={profileSurveys.find((s) => s.surveyType === survey.type)}
              industry={questionnaire?.content?.industry as string | undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
