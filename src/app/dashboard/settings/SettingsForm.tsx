"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Save, ChevronDown } from "lucide-react";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import { updateQuestionnaire } from "./actions";

const INDUSTRY_OPTIONS = [
  "Real Estate",
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
  "Coaching / Consulting": [
    { key: "transformationDelivered", label: "What transformation do you deliver?", placeholder: "Before → after for your clients..." },
    { key: "methodologyName", label: "Do you have a named methodology or framework?", placeholder: "e.g. The 3-Phase System..." },
  ],
  Other: [
    { key: "uniqueValue", label: "What makes your business uniquely valuable?", placeholder: "Your differentiator..." },
  ],
};

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm";

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
              : "border-white/10 bg-background-secondary text-text-muted hover:border-accent-primary/40 hover:text-text-primary"
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
              : "border-white/10 bg-background-secondary text-text-muted hover:border-accent-primary/40 hover:text-text-primary"
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
        className="w-full cursor-pointer"
        style={{ accentColor: "#c8952a" }}
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{
          background: "rgba(200,149,42,0.15)",
          color: "#c8952a",
          border: "1px solid rgba(200,149,42,0.3)",
        }}
      >
        {letter}
      </span>
      <div>
        <h2
          className="text-lg font-bold text-text-primary"
          style={{ fontFamily: "var(--font-playfair)" }}
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
      className="rounded-2xl border p-6 sm:p-8 space-y-5"
      style={{ background: "#111111", borderColor: "rgba(255,255,255,0.07)" }}
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
        <div>
          <FieldLabel>Hobbies & Interests Outside Work</FieldLabel>
          <textarea
            rows={3}
            placeholder="What do you do for fun? What lights you up beyond the business?"
            value={formData.hobbies}
            onChange={(e) => set("hobbies", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>Describe Your Ideal Client</FieldLabel>
          <textarea
            rows={4}
            placeholder="Paint a picture of who you serve best — demographics, mindset, situation, goals..."
            value={formData.idealClient}
            onChange={(e) => set("idealClient", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>What Do Your Best Clients Have in Common?</FieldLabel>
          <textarea
            rows={3}
            placeholder="Patterns you've noticed — values, backgrounds, challenges, traits..."
            value={formData.bestClientCommonalities}
            onChange={(e) => set("bestClientCommonalities", e.target.value)}
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
          <div className="flex items-center justify-center py-10 text-text-muted text-sm rounded-xl border border-dashed border-white/10">
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

      {/* Section D — Local Expert */}
      <SectionCard>
        <SectionHeading
          letter="D"
          title="Local Expert"
          subtitle="Anchor your brand to your community."
        />
        <div>
          <FieldLabel>Favourite Local Spots</FieldLabel>
          <textarea
            rows={4}
            placeholder="Coffee shops, restaurants, parks, venues you love..."
            value={formData.localSpots}
            onChange={(e) => set("localSpots", e.target.value)}
            className={textareaClass}
          />
        </div>
        <div>
          <FieldLabel>What Makes Your Community Unique?</FieldLabel>
          <textarea
            rows={4}
            placeholder="What would you want clients to know about your market or city?"
            value={formData.communityUniqueness}
            onChange={(e) => set("communityUniqueness", e.target.value)}
            className={textareaClass}
          />
        </div>
      </SectionCard>

      {/* Section E — Content Preferences */}
      <SectionCard>
        <SectionHeading
          letter="E"
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
      </SectionCard>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-4 pt-2 pb-8">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-60 hover:opacity-90"
          style={{ background: "#c8952a", color: "#0a0a0a" }}
        >
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
