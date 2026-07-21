"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Save, ChevronDown } from "lucide-react";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import { updateQuestionnaire } from "./actions";

const INDUSTRY_OPTIONS = [
  "Real Estate",
  "Car Sales",
  "Fitness / Personal Training",
  "Financial Services",
  "Coaching / Consulting",
  "Other",
];

const BRAND_TYPE_OPTIONS = ["Personal Brand", "Business Brand", "Both"];

const PERSONALITY_OPTIONS = [
  "Energetic & Motivating",
  "Calm & Educational",
  "Witty & Humorous",
  "Authoritative & Expert",
  "Relatable & Vulnerable",
  "Inspirational & Visionary",
];

const CONTENT_ENJOYED = [
  "Short-form video (Reels/TikTok)",
  "Long-form video (YouTube)",
  "Carousels & infographics",
  "Talking-head clips",
  "Behind-the-scenes",
  "Client testimonials",
  "Educational how-tos",
  "Lifestyle / day-in-the-life",
];

const CTA_OPTIONS = [
  "DM me",
  "Comment a word",
  "Link in bio",
  "Book a call",
  "No CTA / just value",
];

const HUMOR_OPTIONS = [
  "Dry / Sarcastic",
  "Self-deprecating",
  "Goofy",
  "No humor",
  "Witty wordplay",
];

const SENTENCE_LENGTH_OPTIONS = ["Short & punchy", "Mixed", "Long & flowing"];

const EMOJI_OPTIONS = ["Heavy", "Occasional", "Minimal", "Never"];

const FORMATTING_OPTIONS = [
  "Short paragraphs",
  "Bullet points",
  "One-liners",
  "Long-form",
];

const STORYTELLING_OPTIONS = [
  "Anecdote-driven",
  "Tip / listicle-driven",
  "Myth-busting",
  "Question-driven",
];

const INDUSTRY_QUESTIONS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  "Real Estate": [
    { key: "yearsLicensed", label: "How long have you been licensed?", placeholder: "e.g. 7 years" },
    { key: "niche", label: "What is your niche?", placeholder: "e.g. Luxury condos, first-time buyers..." },
    { key: "biggestMisconception", label: "Biggest misconception buyers/sellers have?", placeholder: "What do clients get wrong most often?" },
  ],
  "Fitness / Personal Training": [
    { key: "loveTrainingMost", label: "Who do you love training most?", placeholder: "Describe your ideal training client..." },
    { key: "biggestFitnessLie", label: "Biggest lie people believe about fitness?", placeholder: "What myth drives you crazy?" },
  ],
  "Financial Services": [
    { key: "specialization", label: "What is your financial specialization?", placeholder: "e.g. Retirement planning, tax strategy..." },
    { key: "clientFear", label: "What is your clients' biggest financial fear?", placeholder: "What keeps them up at night?" },
  ],
  "Car Sales": [
    { key: "yearsInCarSales", label: "How long have you been selling cars?", placeholder: "e.g. 6 years" },
    { key: "dealershipNiche", label: "What do you sell?", placeholder: "e.g. New Toyota, used luxury, lease returns, fleet..." },
    { key: "biggestBuyerMisconception", label: "Biggest misconception car buyers have?", placeholder: "What do customers get wrong most often?" },
    { key: "carBrands", label: "Which car brands do you focus on? (optional)", placeholder: "e.g. Toyota, Honda, BMW, Ford..." },
  ],
  "Coaching / Consulting": [
    { key: "transformationDelivered", label: "What transformation do you deliver?", placeholder: "Before → after for your clients..." },
    { key: "methodologyName", label: "Do you have a named methodology or framework?", placeholder: "e.g. The 3-Phase System..." },
  ],
  Other: [
    { key: "uniqueValue", label: "What makes your business uniquely valuable?", placeholder: "Your differentiator..." },
  ],
};

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-border-primary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm";

const textareaClass = inputClass + " resize-none";

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-text-primary mb-1.5">
      {children}
      {required && <span className="text-accent-primary ml-1">*</span>}
    </label>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => toggle(opt)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            selected.includes(opt)
              ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
              : "border-border-primary bg-background-secondary text-text-muted hover:border-accent-primary/40 hover:text-text-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition-all ${
            value === opt
              ? "border-accent-primary bg-accent-primary/15 text-accent-primary"
              : "border-border-primary bg-background-secondary text-text-muted hover:border-accent-primary/40 hover:text-text-primary"
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function DaysSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-3">
      <input
        type="range"
        min={1}
        max={7}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-primary cursor-pointer"
      />
      <div className="flex justify-between">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className={`text-xs w-8 text-center transition-colors ${
              value === i + 1 ? "text-accent-primary font-bold" : "text-text-muted"
            }`}
          >
            {i + 1}
          </span>
        ))}
      </div>
      <p className="text-center text-sm text-text-muted">
        <span className="text-accent-primary font-semibold text-base">{value}</span>{" "}
        day{value !== 1 ? "s" : ""} per week
      </p>
    </div>
  );
}

function SectionHeading({
  letter,
  title,
  subtitle,
}: {
  letter: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
      >
        {letter}
      </span>
      <div>
        <h2
          className="text-lg font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {title}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border-primary bg-background-card p-4 sm:p-6 space-y-5"
    >
      {children}
    </div>
  );
}

export default function SettingsForm({
  questionnaireId,
  initialData,
}: {
  questionnaireId: string;
  initialData: QuestionnaireFormData;
}) {
  const [formData, setFormData] = useState<QuestionnaireFormData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const set = (key: keyof QuestionnaireFormData, value: unknown) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const setIndustryAnswer = (key: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      industryAnswers: { ...prev.industryAnswers, [key]: value },
    }));

  const handleSave = () => {
    setStatus("idle");
    startTransition(async () => {
      const result = await updateQuestionnaire(questionnaireId, formData);
      if (result.success) {
        setStatus("success");
        setTimeout(() => setStatus("idle"), 4000);
      } else {
        setStatus("error");
        setErrorMessage(result.error);
      }
    });
  };

  const industryQuestions = formData.industry
    ? (INDUSTRY_QUESTIONS[formData.industry] ?? [])
    : [];

  return (
    <div className="space-y-6">
      {/* Toast / Status Banner */}
      {status === "success" && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">Changes saved successfully.</p>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Section A — Who You Are */}
      <SectionCard>
        <SectionHeading
          letter="A"
          title="Who You Are"
          subtitle="Core identity fields that power your brand voice."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <FieldLabel required>Your Name</FieldLabel>
            <input
              type="text"
              placeholder="Jane Smith"
              value={formData.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <FieldLabel>Business Name</FieldLabel>
            <input
              type="text"
              placeholder="Smith Realty Group"
              value={formData.businessName}
              onChange={(e) => set("businessName", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <FieldLabel>City / Market</FieldLabel>
          <input
            type="text"
            placeholder="Miami, FL"
            value={formData.city}
            onChange={(e) => set("city", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel required>What exactly do you do?</FieldLabel>
          <textarea
            rows={4}
            placeholder="Describe your work in plain language — what you do, who you help, and how..."
            value={formData.whatYouDo}
            onChange={(e) => set("whatYouDo", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel required>Industry</FieldLabel>
          <div className="relative">
            <select
              value={formData.industry}
              onChange={(e) => {
                set("industry", e.target.value);
                set("industryAnswers", {});
              }}
              className={inputClass + " appearance-none pr-10"}
            >
              <option value="" disabled>
                Select your industry...
              </option>
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o} value={o} className="bg-background-secondary">
                  {o}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          </div>
        </div>
        <div>
          <FieldLabel>Brand Type</FieldLabel>
          <RadioGroup
            options={BRAND_TYPE_OPTIONS}
            value={formData.brandType}
            onChange={(v) => set("brandType", v)}
          />
        </div>
      </SectionCard>

      {/* Section B — Your Story */}
      <SectionCard>
        <SectionHeading
          letter="B"
          title="Your Story"
          subtitle="The human side of your brand — this is where connection happens."
        />
        <div>
          <FieldLabel>Your Personal Story</FieldLabel>
          <textarea
            rows={5}
            placeholder="Share the journey that led you here..."
            value={formData.personalStory}
            onChange={(e) => set("personalStory", e.target.value)}
            className={textareaClass}
          />
        </div>
      </SectionCard>

      {/* Section C — Industry Deep-Dive */}
      <SectionCard>
        <SectionHeading
          letter="C"
          title="Industry Deep-Dive"
          subtitle={
            formData.industry
              ? `Specific context for ${formData.industry} professionals.`
              : "Select your industry in Section A to unlock these fields."
          }
        />
        {industryQuestions.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-text-muted text-sm rounded-xl border border-dashed border-border-primary">
            No industry selected — update Section A first.
          </div>
        ) : (
          <div className="space-y-5">
            {industryQuestions.map((q) => (
              <div key={q.key}>
                <FieldLabel>{q.label}</FieldLabel>
                <textarea
                  rows={3}
                  placeholder={q.placeholder}
                  value={formData.industryAnswers[q.key] ?? ""}
                  onChange={(e) => setIndustryAnswer(q.key, e.target.value)}
                  className={textareaClass}
                />
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Section D — Content Preferences */}
      <SectionCard>
        <SectionHeading
          letter="D"
          title="Content Preferences"
          subtitle="How you show up — and how often."
        />
        <div>
          <FieldLabel>On-Camera Personality</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Select all that apply</p>
          <MultiSelect
            options={PERSONALITY_OPTIONS}
            selected={formData.onCameraPersonality}
            onChange={(v) => set("onCameraPersonality", v)}
          />
        </div>
        <div>
          <FieldLabel>Content Formats You Enjoy</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Select all that feel natural to you</p>
          <MultiSelect
            options={CONTENT_ENJOYED}
            selected={formData.contentEnjoyed}
            onChange={(v) => set("contentEnjoyed", v)}
          />
        </div>
        <div>
          <FieldLabel>How many days a week do you want to post?</FieldLabel>
          <div className="mt-4">
            <DaysSlider
              value={formData.daysToPost}
              onChange={(v) => set("daysToPost", v)}
            />
          </div>
        </div>
        <div>
          <FieldLabel required>Primary marketing goal this month</FieldLabel>
          <div className="relative">
            <select
              value={formData.primaryGoal}
              onChange={(e) => set("primaryGoal", e.target.value)}
              className={inputClass + " appearance-none pr-10"}
            >
              <option value="" disabled>Select your goal...</option>
              <option value="Brand Awareness">Brand Awareness</option>
              <option value="Lead Generation">Lead Generation</option>
              <option value="Event/Webinar Signups">Event / Webinar Signups</option>
              <option value="Recruitment/Partnerships">Recruitment / Partnerships</option>
              <option value="Education/Authority">Education / Authority</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          </div>
        </div>
        <div>
          <FieldLabel>Words or phrases the AI should NEVER use</FieldLabel>
          <textarea
            rows={3}
            placeholder={`e.g. "hustle", "dream home", "boss babe" — anything that feels off-brand or cliché to you`}
            value={formData.antiBrandWords}
            onChange={(e) => set("antiBrandWords", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Numbers that impress you (proof points for content)</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Stats, milestones, or metrics that build credibility</p>
          <textarea
            rows={2}
            placeholder={`e.g. "100+ deals closed", "15 years in the business", "$50M in sales volume"`}
            value={formData.numbersThatImpress}
            onChange={(e) => set("numbersThatImpress", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>A recent win worth bragging about</FieldLabel>
          <p className="text-xs text-text-muted mb-3">A deal, client result, or achievement from the last 30 days</p>
          <textarea
            rows={2}
            placeholder={`e.g. "Just closed a deal 3 days after listing, above asking price"`}
            value={formData.recentWin}
            onChange={(e) => set("recentWin", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Top 3 questions you get asked all the time</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Your FAQ — these make great content topics</p>
          <textarea
            rows={3}
            placeholder={`1. How much down payment do I need?\n2. Is now a good time to buy?\n3. ...`}
            value={formData.faqTop3}
            onChange={(e) => set("faqTop3", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Seasonal rhythm of your business</FieldLabel>
          <p className="text-xs text-text-muted mb-3">When does your market heat up or slow down?</p>
          <textarea
            rows={2}
            placeholder={`e.g. "Spring is listing season, December is dead, September picks back up"`}
            value={formData.seasonalRhythm}
            onChange={(e) => set("seasonalRhythm", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Upcoming events or launches in the next 30-60 days</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Open houses, course launches, market updates, speaking gigs</p>
          <textarea
            rows={2}
            placeholder={`e.g. "Open house on the 15th, new lead magnet launching next week"`}
            value={formData.upcomingEvents}
            onChange={(e) => set("upcomingEvents", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Words or catchphrases you use a lot</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Things you say all the time and want to be known for</p>
          <textarea
            rows={2}
            placeholder={`e.g. "here's the thing", "let's get into it", "straight talk"`}
            value={formData.signaturePhrases}
            onChange={(e) => set("signaturePhrases", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Words that feel on-brand for you</FieldLabel>
          <p className="text-xs text-text-muted mb-3">The vocabulary of your brand — words the AI should lean into</p>
          <textarea
            rows={2}
            placeholder={`e.g. "no fluff", "real talk", "done right", "unapologetic"`}
            value={formData.brandWords}
            onChange={(e) => set("brandWords", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>What are you currently promoting or selling?</FieldLabel>
          <p className="text-xs text-text-muted mb-3">This makes your CTAs specific instead of generic</p>
          <textarea
            rows={2}
            placeholder={`e.g. "Free buyer consultation", "12-week coaching program", "Download my free guide"`}
            value={formData.currentOffer}
            onChange={(e) => set("currentOffer", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Preferred call-to-action style</FieldLabel>
          <RadioGroup
            options={CTA_OPTIONS}
            value={formData.preferredCTA}
            onChange={(v) => set("preferredCTA", v)}
          />
        </div>
        <div>
          <FieldLabel>{`Paste 1-3 posts or captions you've written that feel most "you"`}</FieldLabel>
          <p className="text-xs text-text-muted mb-3">The single most powerful way to calibrate your voice — paste real examples</p>
          <textarea
            rows={6}
            placeholder={`Paste posts, captions, or even emails you've written that capture your tone perfectly...`}
            value={formData.contentSample}
            onChange={(e) => set("contentSample", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>How would friends describe the way you talk?</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Verbal texture — pace, rhythm, style</p>
          <textarea
            rows={2}
            placeholder={`e.g. "fast-paced and punchy", "slow and thoughtful", "lots of analogies"`}
            value={formData.speakingStyle}
            onChange={(e) => set("speakingStyle", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Humor style</FieldLabel>
          <RadioGroup
            options={HUMOR_OPTIONS}
            value={formData.humorStyle}
            onChange={(v) => set("humorStyle", v)}
          />
        </div>
        <div>
          <FieldLabel>Sentence length preference</FieldLabel>
          <RadioGroup
            options={SENTENCE_LENGTH_OPTIONS}
            value={formData.sentenceLength}
            onChange={(v) => set("sentenceLength", v)}
          />
        </div>
        <div>
          <FieldLabel>What do you call your followers/audience?</FieldLabel>
          <p className="text-xs text-text-muted mb-3">How you refer to your community — this shapes how the AI addresses them</p>
          <input
            type="text"
            placeholder={`e.g. "fam", "team", "y'all", or leave blank for none`}
            value={formData.audienceLabel}
            onChange={(e) => set("audienceLabel", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <FieldLabel>What exact words do your clients use when describing their problem?</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Mirror their language in hooks for instant resonance</p>
          <textarea
            rows={2}
            placeholder={`e.g. "I'm stuck", "I feel behind", "I don't know where to start"`}
            value={formData.clientWords}
            onChange={(e) => set("clientWords", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>{`Anything you DON'T want to show or talk about?`}</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Content boundaries — prevents unusable suggestions</p>
          <textarea
            rows={2}
            placeholder={`e.g. "don't show my kids' faces", "no political topics", "don't feature clients by name"`}
            value={formData.contentBoundaries}
            onChange={(e) => set("contentBoundaries", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>{`Anything about your life outside work you're comfortable sharing?`}</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Fuels authentic Personal bucket content</p>
          <textarea
            rows={2}
            placeholder={`Kids, pets, partner, where you live, hobbies...`}
            value={formData.familyContext}
            onChange={(e) => set("familyContext", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>What does your typical morning look like?</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Perfect for day-in-the-life content</p>
          <textarea
            rows={2}
            placeholder={`e.g. "5am gym, coffee, journal, inbox by 8"`}
            value={formData.morningRoutine}
            onChange={(e) => set("morningRoutine", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>{`What's a controversial opinion in your industry you're willing to stake your name on?`}</FieldLabel>
          <p className="text-xs text-text-muted mb-3">Hot takes drive engagement</p>
          <textarea
            rows={2}
            placeholder={`The thing other professionals won't say out loud...`}
            value={formData.hotTakes}
            onChange={(e) => set("hotTakes", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Emoji usage</FieldLabel>
          <RadioGroup
            options={EMOJI_OPTIONS}
            value={formData.emojiUsage}
            onChange={(v) => set("emojiUsage", v)}
          />
        </div>
        <div>
          <FieldLabel>Formatting style</FieldLabel>
          <RadioGroup
            options={FORMATTING_OPTIONS}
            value={formData.formattingStyle}
            onChange={(v) => set("formattingStyle", v)}
          />
        </div>
        <div>
          <FieldLabel>Storytelling style</FieldLabel>
          <RadioGroup
            options={STORYTELLING_OPTIONS}
            value={formData.storytellingStyle}
            onChange={(v) => set("storytellingStyle", v)}
          />
        </div>
      </SectionCard>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-8">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 hover:opacity-90 bg-accent-primary text-white hover:bg-accent-primary/90"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
