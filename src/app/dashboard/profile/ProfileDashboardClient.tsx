"use client";

import { useState, useTransition } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  User,
  Mail,
  MapPin,
  LogOut,
  Save,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Building2,
  Sword,
  BookOpen,
  Users,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  RefreshCw,
} from "lucide-react";
import { saveProfileSurvey, deleteProfileSurvey, updateOnboarding } from "./actions";
import ChangePasswordForm from "./ChangePasswordForm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionnaireData {
  name?: string;
  businessName?: string;
  city?: string;
  whatYouDo?: string;
  industry?: string;
  brandType?: string;
  personalStory?: string;
  industryAnswers?: Record<string, string>;
  onCameraPersonality?: string[];
  contentEnjoyed?: string[];
  daysToPost?: number;
  primaryGoal?: string;
  antiBrandWords?: string;
  [key: string]: unknown;
}

interface ProfileSurveyRecord {
  id: string;
  surveyType: string;
  answersJson: Record<string, string>;
  updatedAt?: string;
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

// Survey definitions (used for both the accordion and the inline forms)
const CORE_FOUNDATION_DEF = {
  type: "CORE_FOUNDATION",
  title: "Core Foundation",
  subtitle: "Your original onboarding answers — the backbone of your brand voice.",
  icon: ClipboardList,
  color: "#1E56D6",
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

// US holiday-specific fields by month (0-indexed)
const HOLIDAY_FIELDS_BY_MONTH: Record<number, SurveyField[]> = {
  0: [ // January — New Year's Day
    { key: "newYearsPlans", label: "Any plans for New Year's Day?", placeholder: "Brunch, football, recovery, fresh starts..." },
    { key: "newYearsTraditions", label: "How do you typically ring in the new year?", placeholder: "Annual traditions, resolutions, reflection rituals..." },
    { key: "newYearsContent", label: "Any New Year's content ideas?", placeholder: "Goal-setting, fresh starts, year-in-review, predictions for the year ahead..." },
  ],
  1: [ // February — Valentine's Day, Presidents' Day
    { key: "valentinesPlans", label: "Any Valentine's Day plans?", placeholder: "Date nights, gifts, Galentine's celebrations..." },
    { key: "valentinesContent", label: "Any Valentine's Day content ideas?", placeholder: "Love, relationships, appreciation, anti-Valentine's takes..." },
  ],
  2: [ // March — St. Patrick's Day
    { key: "stPatricksPlans", label: "Any St. Patrick's Day plans?", placeholder: "Parades, pub crawls, Irish food, family traditions..." },
    { key: "stPatricksContent", label: "Any St. Patrick's Day content ideas?", placeholder: "Local events, Irish heritage, fun angles for your brand..." },
  ],
  3: [ // April — Easter
    { key: "easterPlans", label: "Any Easter plans?", placeholder: "Family gatherings, egg hunts, brunch, church..." },
    { key: "easterContent", label: "Any Easter content ideas?", placeholder: "Spring themes, renewal, family traditions, local Easter events..." },
  ],
  4: [ // May — Mother's Day, Memorial Day
    { key: "mothersDayPlans", label: "Any Mother's Day plans?", placeholder: "Brunch, gifts, family time, honoring mom..." },
    { key: "mothersDayContent", label: "Any Mother's Day content ideas?", placeholder: "Appreciation posts, mom stories, gift guides..." },
    { key: "memorialDayPlans", label: "Any Memorial Day plans?", placeholder: "BBQs, beach, camping, the unofficial start of summer..." },
    { key: "memorialDayContent", label: "Any Memorial Day content ideas?", placeholder: "Summer kickoff, gratitude, local events, remembrance..." },
  ],
  5: [ // June — Father's Day, Juneteenth
    { key: "fathersDayPlans", label: "Any Father's Day plans?", placeholder: "BBQ, gifts, family time, honoring dad..." },
    { key: "fathersDayContent", label: "Any Father's Day content ideas?", placeholder: "Dad stories, appreciation, gift guides..." },
    { key: "juneteenthContent", label: "Any Juneteenth content ideas?", placeholder: "Reflection, education, celebration, community events..." },
  ],
  6: [ // July — Independence Day
    { key: "july4Plans", label: "Any plans for Independence Day (July 4th)?", placeholder: "BBQs, fireworks, beach days, parades, family gatherings..." },
    { key: "july4Traditions", label: "How do you typically celebrate the 4th?", placeholder: "Annual traditions, favorite fireworks spots, go-to BBQ recipes, host or attend..." },
    { key: "july4Content", label: "Any July 4th content ideas?", placeholder: "Patriotic angles, local events, holiday-themed posts, what freedom means to you..." },
  ],
  7: [ // August — no major federal holidays, back-to-school season
    { key: "backToSchool", label: "Any back-to-school season content ideas?", placeholder: "Fall prep, new routines, seasonal transitions, school-related angles for your brand..." },
  ],
  8: [ // September — Labor Day
    { key: "laborDayPlans", label: "Any Labor Day plans?", placeholder: "Last summer hurrah, BBQ, beach, weekend trip..." },
    { key: "laborDayContent", label: "Any Labor Day content ideas?", placeholder: "Summer wrap-up, fall transition, work ethic reflections, gratitude..." },
  ],
  9: [ // October — Halloween
    { key: "halloweenPlans", label: "Any Halloween plans?", placeholder: "Costumes, parties, trick-or-treating, haunted houses..." },
    { key: "halloweenContent", label: "Any Halloween content ideas?", placeholder: "Spooky themes, costumes, local events, scary stories, fun holiday angles..." },
  ],
  10: [ // November — Veterans Day, Thanksgiving
    { key: "veteransDayContent", label: "Any Veterans Day content ideas?", placeholder: "Gratitude, service, reflection, honoring veterans..." },
    { key: "thanksgivingPlans", label: "Any Thanksgiving plans?", placeholder: "Family gatherings, turkey, Friendsgiving, travel..." },
    { key: "thanksgivingTraditions", label: "What are your Thanksgiving traditions?", placeholder: "The turkey fry, the gratitude circle, the football game, the leftovers..." },
    { key: "thanksgivingContent", label: "Any Thanksgiving content ideas?", placeholder: "Gratitude posts, food content, family stories, what you're thankful for in business and life..." },
  ],
  11: [ // December — Christmas, Hanukkah, New Year's Eve
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

// ─── Core Foundation inline panel ────────────────────────────────────────────

const PRIMARY_GOAL_OPTIONS = [
  "Brand Awareness",
  "Lead Generation",
  "Event/Webinar Signups",
  "Recruitment/Partnerships",
  "Education/Authority",
];

const CORE_DISPLAY_FIELDS: { key: string; label: string; placeholder?: string; rows?: number }[] = [
  { key: "name", label: "Your Name", placeholder: "Jane Smith" },
  { key: "businessName", label: "Business Name", placeholder: "Smith Realty Group" },
  { key: "city", label: "City / Market", placeholder: "Miami, FL" },
  { key: "whatYouDo", label: "What You Do", placeholder: "Describe your work...", rows: 3 },
  { key: "personalStory", label: "Personal Story", placeholder: "Share your journey...", rows: 4 },
  { key: "antiBrandWords", label: "Words AI should NEVER use", placeholder: `e.g. "hustle", "dream home", "boss babe"`, rows: 2 },
];

function CoreFoundationPanel({ questionnaire }: { questionnaire: Props["questionnaire"] }) {
  const initialData = questionnaire?.content ?? {};
  const [isEditing, setIsEditing] = useState(!questionnaire);
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
        setIsEditing(false);
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Unknown error");
      }
    });
  };

  if (!isEditing && questionnaire) {
    const c = questionnaire.content;
    return (
      <div className="pt-4 space-y-4">
        <StatusBanner status={status} error={errorMsg} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CORE_DISPLAY_FIELDS.map(({ key, label }) => {
            const val = c[key];
            if (!val || (typeof val === "string" && val.trim() === "")) return null;
            return (
              <div key={key} className={`space-y-1 ${(key === "personalStory" || key === "whatYouDo" || key === "antiBrandWords") ? "sm:col-span-2" : ""}`}>
                <p className="text-xs font-medium text-text-muted">{label}</p>
                <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">
                  {String(val)}
                </p>
              </div>
            );
          })}
          {c.primaryGoal && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-text-muted">Primary Marketing Goal</p>
              <p className="text-sm text-text-primary leading-relaxed bg-background-secondary rounded-lg px-3 py-2 border border-border-primary/50">{String(c.primaryGoal)}</p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-border-primary text-text-muted hover:text-text-primary hover:border-border-secondary transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit answers
        </button>
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4">
      <StatusBanner status={status} error={errorMsg} />
      {CORE_DISPLAY_FIELDS.map(({ key, label, placeholder, rows = 2 }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>
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
        <label className="block text-xs font-medium text-text-muted mb-1.5">Primary marketing goal this month</label>
        <select
          value={typeof formData.primaryGoal === "string" ? formData.primaryGoal : ""}
          onChange={(e) => set("primaryGoal", e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>Select your goal...</option>
          {PRIMARY_GOAL_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        {questionnaire && (
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
            <span className="hidden xs:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary sm:inline-flex">
              {badge}
            </span>
          )}
          {isCompleted ? (
            <span className="hidden xs:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20 sm:inline-flex">
              {badge ? "Current" : "Completed"}
            </span>
          ) : badge ? (
            <span className="hidden xs:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 sm:inline-flex">
              Expired
            </span>
          ) : (
            <span className="hidden xs:inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-background-secondary text-text-muted border border-border-primary sm:inline-flex">
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

export default function ProfileDashboardClient({ questionnaire, profileSurveys }: Props) {
  const { data: session } = useSession();
  const industry = questionnaire?.content?.industry as string | undefined;
  const completedCount = profileSurveys.length + (questionnaire ? 1 : 0);
  const totalCount = DEEP_DIVE_SURVEYS.length + 1;

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 space-y-4 sm:space-y-6">
      {/* ── Personal Info Header ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          {/* Avatar */}
          {session?.user?.image ? (
            <img src={session.user.image} alt="avatar" className="h-14 w-14 rounded-full object-cover border-2 border-accent-primary shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-accent-primary/20 flex items-center justify-center text-lg font-bold text-accent-primary border-2 border-accent-primary shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-serif)" }}>
              {session?.user?.name ?? "Your Profile"}
            </h1>
            <p className="text-sm text-text-muted">{session?.user?.email}</p>
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 text-sm text-text-muted mb-5">
          {session?.user?.email && (
            <span className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{session.user.email}</span>
            </span>
          )}
          {questionnaire?.content?.city && (
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{questionnaire.content.city}</span>
            </span>
          )}
          {questionnaire?.content?.businessName && (
            <span className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{questionnaire.content.businessName}</span>
            </span>
          )}
        </div>

        {/* AI context progress */}
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

        {/* Change password */}
        <div className="mt-5 pt-5 border-t border-border-primary">
          <ChangePasswordForm />
        </div>

        {/* Sign out */}
        <div className="mt-5 pt-5 border-t border-border-primary">
          <button
            onClick={() => signOut({ redirect: false }).then(() => { window.location.href = "/login"; })}
            className="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Deep Dive callout ── */}
      <div className="rounded-xl border border-accent-primary/20 bg-accent-primary/5 px-4 sm:px-5 py-4">
        <p className="text-sm font-semibold text-accent-primary mb-1">The more you put in, the more bespoke your posts become.</p>
        <p className="text-sm text-text-muted leading-relaxed">
          Each section below feeds the AI hyper-specific details about your personality, market, and clients that no generic tool will ever have. A half-filled answer still helps — but those who complete every section get posts that sound like <em>them</em>, not a template.
        </p>
      </div>

      {/* ── Survey accordion list ── */}
      <div className="space-y-3">
        {/* Core Foundation row */}
        <AccordionRow
          icon={CORE_FOUNDATION_DEF.icon}
          title={CORE_FOUNDATION_DEF.title}
          subtitle={CORE_FOUNDATION_DEF.subtitle}
          color={CORE_FOUNDATION_DEF.color}
          isCompleted={!!questionnaire}
        >
          <CoreFoundationPanel questionnaire={questionnaire} />
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
    </div>
  );
}
