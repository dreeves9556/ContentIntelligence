"use client";

import { useState, useTransition } from "react";
import {
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  MapPin,
  Sword,
  BookOpen,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  RefreshCw,
  Brain,
  Settings as SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { saveProfileSurvey, deleteProfileSurvey } from "../profile/actions";
import SettingsForm from "../settings/SettingsForm";
import BrandBrainClient from "../brand-brain/BrandBrainClient";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import type { MemoryType } from "@prisma/client";
import type { CreatorMemoryData } from "@/lib/memory/memory-types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileSurveyRecord {
  id: string;
  surveyType: string;
  answersJson: Record<string, string>;
  updatedAt?: string;
}

interface Props {
  questionnaire: { id: string; formData: QuestionnaireFormData; lastUpdated: string | null } | null;
  profileSurveys: ProfileSurveyRecord[];
  groupedMemories: Record<MemoryType, CreatorMemoryData[]>;
  typeLabels: Record<MemoryType, string>;
  typeDescriptions: Record<MemoryType, string>;
  memoryStats: { total: number; pinned: number; highConfidence: number };
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

const DEEP_DIVE_SURVEYS: SurveyDef[] = [
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
      { key: "topRestaurants", label: "Your 5 favorite restaurants and what's good there?", placeholder: "1. Maria's Tacqueria — the al pastor is unreal\n2. The Loft — best burger in town\n3. ..." },
      { key: "topCoffeeShops", label: "Your 5 favorite coffee shops and what's special about them?", placeholder: "1. Blue Bottle — the pour-over bar is a ritual\n2. Daydream — they roast their own beans\n3. ..." },
      { key: "topShops", label: "Your 5 favorite local shops or boutiques and what makes them great?", placeholder: "1. Foundry — curated vintage and local makers\n2. Olive & Birch — the best home goods\n3. ..." },
      { key: "topParks", label: "Your 5 favorite parks or outdoor spots and what's special about them?", placeholder: "1. Riverside Trail — 3 miles along the water\n2. Elm Park — best sunset view in the city\n3. ..." },
      { key: "topGyms", label: "Your 5 favorite gyms, studios, or fitness spots and what stands out?", placeholder: "1. Iron Yard — 24/7 access, old-school vibe\n2. Flow Yoga — the heated classes are unmatched\n3. ..." },
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
      { key: "disagreesWith", label: "Common advice you publicly disagree with?", placeholder: "The myth you push back on at every dinner party..." },
      { key: "negotiationStyle", label: "Your negotiation style in 3 words?", placeholder: "e.g. Patient, Strategic, Relentless" },
      { key: "mostCommonDM", label: "What's the #1 question you get in your DMs?", placeholder: "The question you answer so often you could do it in your sleep..." },
      { key: "trophyRoomWin", label: "The Trophy Room: A recent 'miracle' win you pulled off for a client that seemed impossible?", placeholder: "The deal everyone said couldn't be done..." },
      { key: "objectionCrusher", label: "The Objection Crusher: Most common reason a prospect says 'no' or 'I want to wait', and how you respond?", placeholder: "The hesitation you've heard a hundred times..." },
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
      { key: "clientMisbeliefs", label: "What do clients wrongly believe they should do first? (myth-busting fuel)", placeholder: "The common misconception you love correcting in your content..." },
      { key: "clientDreamOutcome", label: "What is your client's dream outcome — in their own words?", placeholder: "The transformation they fantasize about but rarely say out loud..." },
      { key: "beforeAfterStory", label: "A real client before → after story?", placeholder: "Where they started, what you did, where they ended up..." },
    ],
  },
];

// ─── Time-based context surveys (weekly & monthly) ────────────────────────────

interface TimedSurveyDef extends SurveyDef {
  resetLabel: string;
  isExpired: (updatedAt: string | undefined) => boolean;
}

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

const WEEKLY_CONTEXT_DEF: TimedSurveyDef = {
  type: "WEEKLY_CONTEXT",
  title: "Weekly Context",
  subtitle: "What's happening THIS week — refreshes every Sunday.",
  icon: CalendarDays,
  color: "#f59e0b",
  resetLabel: "Resets every Sunday",
  isExpired: (updatedAt) => {
    if (!updatedAt) return true;
    return new Date(updatedAt) < getLastSunday();
  },
  fields: [
    { key: "personalHighlights", label: "What's happening personally this week?", placeholder: "Family stuff, social plans, things you're excited about outside of work..." },
    { key: "professionalUpdates", label: "What's happening professionally this week?", placeholder: "Deals in motion, client meetings, projects, launches, deadlines..." },
    { key: "newSpots", label: "Any new restaurants, hangouts, or spots you've discovered?", placeholder: "Tried a new coffee shop? Found a hidden trail? A new lunch spot?" },
    { key: "winsMoments", label: "Any wins, stories, or moments worth sharing this week?", placeholder: "A client win, a funny moment, something that surprised you..." },
    { key: "onYourMind", label: "What's on your mind this week that could spark content?", placeholder: "An opinion forming, a question you keep getting asked, a trend you're noticing..." },
  ],
};

const MONTHLY_CONTEXT_BASE_FIELDS: SurveyField[] = [
  { key: "monthlyTheme", label: "What's the big theme or focus for this month?", placeholder: "e.g., 'client success stories', 'behind-the-scenes month', 'myth-busting March'..." },
  { key: "majorMilestones", label: "Any major milestones, launches, or events this month?", placeholder: "Anniversaries, product launches, big meetings, conferences, personal milestones..." },
  { key: "newGoals", label: "New goals or priorities you're focused on this month?", placeholder: "What are you pushing toward that's different from last month?" },
  { key: "businessChanges", label: "What's changing in your business this month?", placeholder: "New offerings, new team members, process changes, market shifts you're responding to..." },
  { key: "travelPlans", label: "Any travel or personal plans this month that could inspire content?", placeholder: "Trips, events, seasonal activities, family plans..." },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const HOLIDAY_FIELDS_BY_MONTH: Record<number, SurveyField[]> = {
  0: [
    { key: "newYearsPlans", label: "Any plans for New Year's Day?", placeholder: "Brunch, football, recovery, fresh starts..." },
    { key: "newYearsTraditions", label: "How do you typically ring in the new year?", placeholder: "Annual traditions, resolutions, reflection rituals..." },
    { key: "newYearsContent", label: "Any New Year's content ideas?", placeholder: "Goal-setting, fresh starts, year-in-review, predictions for the year ahead..." },
  ],
  1: [
    { key: "valentinesPlans", label: "Any Valentine's Day plans?", placeholder: "Date nights, gifts, Galentine's celebrations..." },
    { key: "valentinesContent", label: "Any Valentine's Day content ideas?", placeholder: "Love, relationships, appreciation, anti-Valentine's takes..." },
  ],
  2: [
    { key: "stPatricksPlans", label: "Any St. Patrick's Day plans?", placeholder: "Parades, pub crawls, Irish food, family traditions..." },
    { key: "stPatricksContent", label: "Any St. Patrick's Day content ideas?", placeholder: "Local events, Irish heritage, fun angles for your brand..." },
  ],
  3: [
    { key: "easterPlans", label: "Any Easter plans?", placeholder: "Family gatherings, egg hunts, brunch, church..." },
    { key: "easterContent", label: "Any Easter content ideas?", placeholder: "Spring themes, renewal, family traditions, local Easter events..." },
  ],
  4: [
    { key: "mothersDayPlans", label: "Any Mother's Day plans?", placeholder: "Brunch, gifts, family time, honoring mom..." },
    { key: "mothersDayContent", label: "Any Mother's Day content ideas?", placeholder: "Appreciation posts, mom stories, gift guides..." },
    { key: "memorialDayPlans", label: "Any Memorial Day plans?", placeholder: "BBQs, beach, camping, the unofficial start of summer..." },
    { key: "memorialDayContent", label: "Any Memorial Day content ideas?", placeholder: "Summer kickoff, gratitude, local events, remembrance..." },
  ],
  5: [
    { key: "fathersDayPlans", label: "Any Father's Day plans?", placeholder: "BBQ, gifts, family time, honoring dad..." },
    { key: "fathersDayContent", label: "Any Father's Day content ideas?", placeholder: "Dad stories, appreciation, gift guides..." },
    { key: "juneteenthContent", label: "Any Juneteenth content ideas?", placeholder: "Reflection, education, celebration, community events..." },
  ],
  6: [
    { key: "july4Plans", label: "Any plans for Independence Day (July 4th)?", placeholder: "BBQs, fireworks, beach days, parades, family gatherings..." },
    { key: "july4Traditions", label: "How do you typically celebrate the 4th?", placeholder: "Annual traditions, favorite fireworks spots, go-to BBQ recipes, host or attend..." },
    { key: "july4Content", label: "Any July 4th content ideas?", placeholder: "Patriotic angles, local events, holiday-themed posts, what freedom means to you..." },
  ],
  7: [
    { key: "backToSchool", label: "Any back-to-school season content ideas?", placeholder: "Fall prep, new routines, seasonal transitions, school-related angles for your brand..." },
  ],
  8: [
    { key: "laborDayPlans", label: "Any Labor Day plans?", placeholder: "Last summer hurrah, BBQ, beach, weekend trip..." },
    { key: "laborDayContent", label: "Any Labor Day content ideas?", placeholder: "Summer wrap-up, fall transition, work ethic reflections, gratitude..." },
  ],
  9: [
    { key: "halloweenPlans", label: "Any Halloween plans?", placeholder: "Costumes, parties, trick-or-treating, haunted houses..." },
    { key: "halloweenContent", label: "Any Halloween content ideas?", placeholder: "Spooky themes, costumes, local events, scary stories, fun holiday angles..." },
  ],
  10: [
    { key: "veteransDayContent", label: "Any Veterans Day content ideas?", placeholder: "Gratitude, service, reflection, honoring veterans..." },
    { key: "thanksgivingPlans", label: "Any Thanksgiving plans?", placeholder: "Family gatherings, turkey, Friendsgiving, travel..." },
    { key: "thanksgivingTraditions", label: "What are your Thanksgiving traditions?", placeholder: "The turkey fry, the gratitude circle, the football game, the leftovers..." },
    { key: "thanksgivingContent", label: "Any Thanksgiving content ideas?", placeholder: "Gratitude posts, food content, family stories, what you're thankful for in business and life..." },
  ],
  11: [
    { key: "christmasPlans", label: "Any Christmas plans?", placeholder: "Family gatherings, gift exchanges, travel, traditions..." },
    { key: "christmasTraditions", label: "What are your Christmas traditions?", placeholder: "Tree cutting, cookie baking, Christmas Eve dinner, morning rituals..." },
    { key: "christmasContent", label: "Any Christmas content ideas?", placeholder: "Holiday themes, gift guides, year-in-review, seasonal tips, festive behind-the-scenes..." },
    { key: "newYearsEvePlans", label: "Any New Year's Eve plans?", placeholder: "Parties, fireworks, quiet night in, reflections on the year..." },
  ],
};

function getMonthlyContextDef(date: Date = new Date()): TimedSurveyDef {
  const month = date.getMonth();
  const monthName = MONTH_NAMES[month];
  const holidayFields = HOLIDAY_FIELDS_BY_MONTH[month] ?? [];
  return {
    type: "MONTHLY_CONTEXT",
    title: "Monthly Context",
    subtitle: `Broad strokes for ${monthName} — refreshes on the 1st.`,
    icon: CalendarRange,
    color: "#8b5cf6",
    resetLabel: "Resets on the 1st of each month",
    isExpired: (updatedAt) => {
      if (!updatedAt) return true;
      return new Date(updatedAt) < getFirstOfMonth(date);
    },
    fields: [...MONTHLY_CONTEXT_BASE_FIELDS, ...holidayFields],
  };
}

function getTimedSurveys(date: Date = new Date()): TimedSurveyDef[] {
  return [WEEKLY_CONTEXT_DEF, getMonthlyContextDef(date)];
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm resize-none";

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

// ─── Deep-dive survey inline panel ───────────────────────────────────────────

function DeepDivePanel({
  survey,
  existing,
  industry,
}: {
  survey: SurveyDef;
  existing: ProfileSurveyRecord | undefined;
  industry?: string;
}) {
  const [isEditing, setIsEditing] = useState(!existing);
  const [answers, setAnswers] = useState<Record<string, string>>(existing?.answersJson ?? {});
  const [isPending, startTransition] = useTransition();
  const [deleteIsPending, startDeleteTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const resolvedFields = survey.fields.map((f) => {
    if (survey.type === "TRENCH_WARFARE" && f.key === "wildestStory" && industry) {
      return { ...f, label: TRENCH_WARFARE_WILDEST_LABEL[industry] ?? f.label };
    }
    if (survey.type === "ORIGIN_STORY" && f.key === "agentPetPeeve" && industry) {
      return { ...f, label: ORIGIN_STORY_PETPEEVE_LABEL[industry] ?? f.label };
    }
    return f;
  });

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProfileSurvey(survey.type, answers);
      if (result.success) {
        setStatus("success");
        setIsEditing(false);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`Clear your "${survey.title}" survey? This cannot be undone.`)) return;
    startDeleteTransition(async () => {
      await deleteProfileSurvey(survey.type);
    });
  };

  if (!isEditing && existing) {
    return (
      <div className="pt-4 space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        <div className="space-y-3">
          {resolvedFields.map((field) => {
            const answer = answers[field.key] ?? existing.answersJson[field.key];
            if (!answer) return null;
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-xs font-medium text-text-muted">{field.label}</p>
                <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">
                  {answer}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit answers
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteIsPending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-red-500/20 text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleteIsPending ? "Clearing…" : "Clear"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <StatusBanner status={status} error={errorMsg} />
      {resolvedFields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{field.label}</label>
          <textarea
            rows={3}
            placeholder={field.placeholder}
            value={answers[field.key] ?? ""}
            onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
            className={inputClass}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1">
        {existing && (
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm text-text-muted border border-border-primary hover:bg-background-secondary transition-colors">
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white disabled:opacity-60 hover:bg-accent-primary/90 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save Survey"}
        </button>
      </div>
    </div>
  );
}

// ─── Timed survey inline panel (weekly/monthly context) ──────────────────────

function TimedSurveyPanel({
  survey,
  existing,
}: {
  survey: TimedSurveyDef;
  existing: ProfileSurveyRecord | undefined;
}) {
  const expired = survey.isExpired(existing?.updatedAt);
  const [isEditing, setIsEditing] = useState(!existing || expired);
  const [answers, setAnswers] = useState<Record<string, string>>(
    existing && !expired ? existing.answersJson : {},
  );
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProfileSurvey(survey.type, answers);
      if (result.success) {
        setStatus("success");
        setIsEditing(false);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  if (!isEditing && existing && !expired) {
    return (
      <div className="pt-4 space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        <div className="space-y-3">
          {survey.fields.map((field) => {
            const answer = answers[field.key] ?? existing.answersJson[field.key];
            if (!answer) return null;
            return (
              <div key={field.key} className="space-y-1">
                <p className="text-xs font-medium text-text-muted">{field.label}</p>
                <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">
                  {answer}
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Update answers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <StatusBanner status={status} error={errorMsg} />
      {expired && existing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <RefreshCw className="h-4 w-4 shrink-0" />
          Your previous answers have expired ({survey.resetLabel}). Update them with what&apos;s happening now.
        </div>
      )}
      {survey.fields.map((field) => (
        <div key={field.key}>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{field.label}</label>
          <textarea
            rows={3}
            placeholder={field.placeholder}
            value={answers[field.key] ?? ""}
            onChange={(e) => setAnswers((p) => ({ ...p, [field.key]: e.target.value }))}
            className={inputClass}
          />
        </div>
      ))}
      <div className="flex flex-wrap gap-3 pt-1">
        {existing && !expired && (
          <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm text-text-muted border border-border-primary hover:bg-background-secondary transition-colors">
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold bg-accent-primary text-white disabled:opacity-60 hover:bg-accent-primary/90 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Accordion row ────────────────────────────────────────────────────────────

function AccordionRow({
  icon: Icon,
  title,
  subtitle,
  color,
  isCompleted,
  badge,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  color: string;
  isCompleted: boolean;
  badge?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border-primary bg-background-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 text-left hover:bg-background-secondary/50 transition-colors"
      >
        <div className="shrink-0 p-2 sm:p-2.5 rounded-xl" style={{ background: `${color}20` }}>
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-primary text-sm" style={{ fontFamily: "var(--font-serif)" }}>{title}</p>
          <p className="text-xs text-text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {badge && (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary">
              {badge}
            </span>
          )}
          {isCompleted ? (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
              {badge ? "Current" : "Completed"}
            </span>
          ) : badge ? (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20">
              Expired
            </span>
          ) : (
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary">
              Not started
            </span>
          )}
          {isCompleted ? (
            <CheckCircle2 className="h-4 w-4 text-green-400 sm:hidden" />
          ) : (
            <div className="h-4 w-4 rounded-full border border-border-secondary sm:hidden" />
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-muted" />
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-border-primary px-4 sm:px-5 pb-4 sm:pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function QuestionnaireClient({
  questionnaire,
  profileSurveys,
  groupedMemories,
  typeLabels,
  typeDescriptions,
  memoryStats,
}: Props) {
  const industry = questionnaire?.formData.industry as string | undefined;
  const completedCount = profileSurveys.length + (questionnaire ? 1 : 0);
  const totalCount = DEEP_DIVE_SURVEYS.length + 1 + 2; // +1 for brand questionnaire, +2 for timed surveys

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 space-y-4 sm:space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
          Questionnaires
        </h1>
        <p className="text-text-muted text-sm mt-1">
          Everything the AI knows about you — your brand, your story, your market, and what it&apos;s learned over time.
        </p>
      </div>

      {/* ── AI context progress ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card p-4 sm:p-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted">AI Context Strength</span>
            <span className="font-medium text-accent-primary">{completedCount}/{totalCount} sections complete</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-background-secondary overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.round((completedCount / totalCount) * 100)}%`, background: "var(--color-accent-primary)" }}
            />
          </div>
          <p className="text-xs text-text-muted">The more you fill in below, the more bespoke your social posts become.</p>
        </div>
      </div>

      {/* ── Deep Dive callout ── */}
      <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-4 sm:px-5 py-4">
        <p className="text-sm font-semibold text-accent-primary mb-1">The more you put in, the more bespoke your posts become.</p>
        <p className="text-sm text-text-muted leading-relaxed">
          Each section below feeds the AI hyper-specific details about your personality, market, and clients that no generic tool will ever have. A half-filled answer still helps — but those who complete every section get posts that sound like <em>them</em>, not a template.
        </p>
      </div>

      {/* ── Accordion list ── */}
      <div className="space-y-3">
        {/* Brand Questionnaire row */}
        <AccordionRow
          icon={ClipboardList}
          title="Brand Questionnaire"
          subtitle="Your core brand settings — identity, story, industry, content preferences, and voice."
          color="#1E56D6"
          isCompleted={!!questionnaire}
        >
          {questionnaire ? (
            <div className="pt-4">
              {questionnaire.lastUpdated && (
                <div className="flex items-center gap-2 mb-4 text-xs text-text-muted">
                  <SettingsIcon className="h-3.5 w-3.5 text-accent-primary" />
                  <span>Last saved: <span className="text-text-primary font-medium">{questionnaire.lastUpdated}</span></span>
                </div>
              )}
              <SettingsForm questionnaireId={questionnaire.id} initialData={questionnaire.formData} />
            </div>
          ) : (
            <div className="pt-4 text-center py-8">
              <ClipboardList className="h-10 w-10 text-accent-primary/40 mx-auto mb-3" />
              <p className="text-sm text-text-muted mb-4">
                Complete the onboarding questionnaire first to set up your brand profile.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-accent-primary text-white hover:bg-accent-primary/90 transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Complete Onboarding
              </Link>
            </div>
          )}
        </AccordionRow>

        {/* Deep-dive rows */}
        {DEEP_DIVE_SURVEYS.map((survey) => {
          const existing = profileSurveys.find((s) => s.surveyType === survey.type);
          return (
            <AccordionRow
              key={survey.type}
              icon={survey.icon}
              title={survey.title}
              subtitle={survey.subtitle}
              color={survey.color}
              isCompleted={!!existing}
            >
              <DeepDivePanel survey={survey} existing={existing} industry={industry} />
            </AccordionRow>
          );
        })}

      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border-primary" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Context Refreshers</span>
        <div className="h-px flex-1 bg-border-primary" />
      </div>

      {/* ── Timed context surveys ── */}
      <div className="space-y-3">
        {/* Timed context surveys (weekly + monthly) */}
        {getTimedSurveys().map((survey) => {
          const existing = profileSurveys.find((s) => s.surveyType === survey.type);
          const expired = survey.isExpired(existing?.updatedAt);
          const isCurrent = !!existing && !expired;
          return (
            <AccordionRow
              key={survey.type}
              icon={survey.icon}
              title={survey.title}
              subtitle={survey.subtitle}
              color={survey.color}
              isCompleted={isCurrent}
              badge={survey.resetLabel}
            >
              <TimedSurveyPanel survey={survey} existing={existing} />
            </AccordionRow>
          );
        })}

      </div>

      {/* ── Divider ── */}
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1 bg-border-primary" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">AI Memory</span>
        <div className="h-px flex-1 bg-border-primary" />
      </div>

      {/* ── Brand Brain section ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card overflow-hidden">
        {/* Section header */}
        <div className="px-4 sm:px-6 py-5 border-b border-border-primary bg-accent-primary/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="shrink-0 p-2.5 rounded-xl bg-accent-primary/15">
              <Brain className="h-5 w-5 text-accent-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>Brand Brain</h2>
              <p className="text-xs text-text-muted mt-0.5">AI-learned memories that shape your content</p>
            </div>
          </div>
          <p className="text-sm text-text-muted leading-relaxed">
            Every time you fill out a questionnaire, generate content, or give feedback, the AI picks up on patterns about who you are, how you speak, and what resonates with your audience. These memories are automatically injected into every content generation prompt — so the more the Brand Brain knows, the less generic your posts become. Think of it as the AI&apos;s long-term notebook about your brand.
          </p>
        </div>

        {/* Stats */}
        <div className="px-4 sm:px-6 py-4 border-b border-border-primary">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.total}</p>
              <p className="text-xs text-text-muted mt-0.5">Total Memories</p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.pinned}</p>
              <p className="text-xs text-text-muted mt-0.5">Pinned</p>
            </div>
            <div className="bg-background-secondary rounded-lg p-3 border border-border-primary text-center">
              <p className="text-xl font-bold text-accent-primary">{memoryStats.highConfidence}</p>
              <p className="text-xs text-text-muted mt-0.5">High Confidence</p>
            </div>
          </div>
        </div>

        {/* Memory categories */}
        <div className="px-4 sm:px-6 py-4">
          <BrandBrainClient
            groupedMemories={groupedMemories}
            typeLabels={typeLabels}
            typeDescriptions={typeDescriptions}
          />
        </div>
      </div>
    </div>
  );
}
