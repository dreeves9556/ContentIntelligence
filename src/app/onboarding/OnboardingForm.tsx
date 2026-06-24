"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";

const SECTIONS = ["Who You Are", "Your Story", "Industry Deep-Dive", "Content Preferences"];

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

const PROFANITY_OPTIONS = ["None", "Occasional", "Comfortable"];

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
    {
      key: "biggestMisconception",
      label: "Biggest misconception buyers/sellers have?",
      placeholder: "What do clients get wrong most often?",
    },
  ],
  "Fitness / Personal Training": [
    { key: "loveTrainingMost", label: "Who do you love training most?", placeholder: "Describe your ideal training client..." },
    {
      key: "biggestFitnessLie",
      label: "Biggest lie people believe about fitness?",
      placeholder: "What myth drives you crazy?",
    },
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

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-text-muted">
        <span>
          Step {current + 1} of {total}
        </span>
        <span>{pct}% complete</span>
      </div>
      <div className="h-1 w-full rounded-full bg-background-secondary overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: "#c8952a" }}
        />
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-text-primary mb-1.5">
      {children}
      {required && <span className="text-accent-primary ml-1">*</span>}
    </label>
  );
}

const inputClass =
  "w-full px-4 py-3 bg-background-secondary border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary/50 transition-all text-sm";

const textareaClass = inputClass + " resize-none";

function MultiSelect({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };
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
        className="w-full accent-accent-primary cursor-pointer"
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
        <span className="text-accent-primary font-semibold text-base">{value}</span> day{value !== 1 ? "s" : ""} per week
      </p>
    </div>
  );
}

export default function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [formData, setFormData] = useState<QuestionnaireFormData>({
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
  });

  const set = (key: keyof QuestionnaireFormData, value: unknown) =>
    setFormData((prev) => ({ ...prev, [key]: value }));

  const setIndustryAnswer = (key: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      industryAnswers: { ...prev.industryAnswers, [key]: value },
    }));

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const res = await fetch("/api/questionnaire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const result = await res.json();
        if (result.success) {
          try {
            sessionStorage.setItem("cip_questionnaire_done", "true");
          } catch {
            // ignore
          }
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("Submit error:", err);
      }
    });
  };

  const sectionHeading = (letter: string, title: string, subtitle: string) => (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
          style={{ background: "rgba(200,149,42,0.15)", color: "#c8952a", border: "1px solid rgba(200,149,42,0.3)" }}
        >
          {letter}
        </span>
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
          {title}
        </h2>
      </div>
      <p className="text-text-muted text-sm ml-11">{subtitle}</p>
    </div>
  );

  const renderSection = () => {
    switch (step) {
      case 0:
        return (
          <>
            {sectionHeading("A", "Who You Are", "Tell us the basics so we can build your brand foundation.")}
            <div className="space-y-5">
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
                <select
                  value={formData.industry}
                  onChange={(e) => {
                    set("industry", e.target.value);
                    set("industryAnswers", {});
                  }}
                  className={inputClass}
                  style={{ backgroundImage: "none" }}
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
              </div>
              <div>
                <FieldLabel>Brand Type</FieldLabel>
                <RadioGroup
                  options={BRAND_TYPE_OPTIONS}
                  value={formData.brandType}
                  onChange={(v) => set("brandType", v)}
                />
              </div>
            </div>
          </>
        );

      case 1:
        return (
          <>
            {sectionHeading("B", "Your Story", "The human side of your brand — this is where connection happens.")}
            <div className="space-y-5">
              <div>
                <FieldLabel>Your Personal Story</FieldLabel>
                <textarea
                  rows={5}
                  placeholder="Share the journey that led you here — the pivotal moments, the why behind what you do..."
                  value={formData.personalStory}
                  onChange={(e) => set("personalStory", e.target.value)}
                  className={textareaClass}
                />
              </div>
            </div>
          </>
        );

      case 2: {
        const questions = formData.industry ? INDUSTRY_QUESTIONS[formData.industry] ?? [] : [];
        return (
          <>
            {sectionHeading(
              "C",
              "Industry Deep-Dive",
              formData.industry
                ? `Specific questions for ${formData.industry} professionals.`
                : "Select your industry in Section A to unlock these questions."
            )}
            {!formData.industry ? (
              <div className="flex items-center justify-center py-16 text-text-muted text-sm rounded-xl border border-dashed border-white/10">
                No industry selected yet — go back to Section A.
              </div>
            ) : (
              <div className="space-y-5">
                {questions.map((q) => (
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
          </>
        );
      }

      case 3:
        return (
          <>
            {sectionHeading("D", "Content Preferences", "How you show up — and how often.")}
            <div className="space-y-7">
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
                  <DaysSlider value={formData.daysToPost} onChange={(v) => set("daysToPost", v)} />
                </div>
              </div>
              <div>
                <FieldLabel required>Primary marketing goal this month</FieldLabel>
                <select
                  value={formData.primaryGoal}
                  onChange={(e) => set("primaryGoal", e.target.value)}
                  className={inputClass}
                  style={{ backgroundImage: "none" }}
                >
                  <option value="" disabled>Select your goal...</option>
                  <option value="Brand Awareness">Brand Awareness</option>
                  <option value="Lead Generation">Lead Generation</option>
                  <option value="Event/Webinar Signups">Event / Webinar Signups</option>
                  <option value="Recruitment/Partnerships">Recruitment / Partnerships</option>
                  <option value="Education/Authority">Education / Authority</option>
                </select>
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
                <FieldLabel>Paste 1-3 posts or captions you've written that feel most "you"</FieldLabel>
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
                <FieldLabel>Profanity comfort level</FieldLabel>
                <RadioGroup
                  options={PROFANITY_OPTIONS}
                  value={formData.profanityComfort}
                  onChange={(v) => set("profanityComfort", v)}
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
                <FieldLabel>Anything you DON'T want to show or talk about?</FieldLabel>
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
                <FieldLabel>Anything about your life outside work you're comfortable sharing?</FieldLabel>
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
                <FieldLabel>What's a controversial opinion in your industry you're willing to stake your name on?</FieldLabel>
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
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const isLastStep = step === SECTIONS.length - 1;

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-black/60 backdrop-blur-md">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-playfair)", color: "#c8952a" }}
          >
            CoreOS
          </h1>
          <span className="text-xs text-text-muted">Brand Questionnaire</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Title block */}
        <div className="text-center mb-10">
          <h2
            className="text-3xl sm:text-4xl font-bold mb-3"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Let&apos;s Define Your Brand
          </h2>
          <p className="text-text-muted text-sm max-w-md mx-auto">
            This questionnaire powers your entire content strategy. Be honest, be specific — the more you share, the better your results.
          </p>
        </div>

        {/* Section nav pills */}
        <div className="flex gap-1.5 mb-8 overflow-x-auto pb-1">
          {SECTIONS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                i === step
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : i < step
                  ? "border-white/20 text-text-muted cursor-pointer hover:border-white/40"
                  : "border-white/5 text-white/20 cursor-default"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <ProgressBar current={step} total={SECTIONS.length} />
        </div>

        {/* Form card */}
        <div
          className="rounded-2xl border p-8 sm:p-10"
          style={{ background: "#111111", borderColor: "rgba(255,255,255,0.07)" }}
        >
          {renderSection()}

          {/* PII disclosure on final step */}
          {isLastStep && (
            <p className="mt-6 text-xs text-text-muted leading-relaxed">
              By submitting, you acknowledge that your answers will be processed by our AI provider (Anthropic) to generate personalized content recommendations. Your data is handled in accordance with our privacy policy.
            </p>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className="px-5 py-2.5 rounded-lg text-sm font-medium border border-white/10 text-text-muted hover:border-white/30 hover:text-text-primary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Back
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="px-7 py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-60"
                style={{ background: "#c8952a", color: "#0a0a0a" }}
              >
                {isPending ? "Saving…" : "Submit & Go to Dashboard →"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="px-7 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "#c8952a", color: "#0a0a0a" }}
              >
                Continue →
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
