"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { updatePlatformConfig } from "./actions";

const ALL_PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
];

const DEFAULT_INSIGHT_PROMPT = `You are a social media content coach. Analyze this creator's recent performance data and provide ONE concise, actionable insight (2-3 sentences max). Be specific with numbers and give a clear recommendation.

PERFORMANCE SUMMARY:
- Total posts: {{totalPosts}}
- Total views: {{totalViews}}
- Average engagement rate: {{avgEngagement}}%
- Views trend (recent vs older): {{viewsTrend}}%

BREAKDOWN BY FORMAT:
{{formatSummary}}

TOP PERFORMING POSTS:
{{topPosts}}

Respond with ONLY the insight text — no headers, no bullet points, no markdown. Keep it under 200 words. Reference specific formats or content types that are working well and give one actionable next step.`;

const DEFAULT_CALENDAR_PROMPT = `You are an elite personal brand content strategist. Your job is to help this creator build an audience that follows THEM — the human — not just their business. The best personal brands on social media win because people see a real person with real interests, opinions, and a life outside work. Review these client questionnaire answers: {{questionnaireAnswers}}. {{usedTitlesBlock}}{{deepDiveBlock}}{{goalBlock}}{{guardrailBlock}}{{voiceBlock}}{{offerBlock}}
Generate a {{daysToPost}}-day content calendar starting today, which is {{currentDay}}, and running for the next {{daysToPost}} consecutive days.

The days must be, in order: {{targetDays}}.

The mix must be: {{formatMix}}. You MUST return your response as raw, valid JSON only matching the exact schema we use for our Calendar UI. Do not include markdown formatting or backticks.

BUCKET DISTRIBUTION — this is the most important balance to get right:
{{bucketDistribution}}

BUCKET DEFINITIONS — read these carefully:
- "Personal" = genuine off-duty human content. Hobbies, passions, family moments, opinions on life, things they geek out about, who they are when they're NOT working. Do NOT tie Personal posts back to their business or add a work lesson at the end. The post should feel like it could exist even if they had a completely different career.
- "Expert" = professional knowledge, hard-won lessons, industry insights, tips, myth-busting, client stories — their work expertise front and centre. Even Expert posts should feel like they're coming from a real human with personality, not a corporate newsletter.
- "Local" = hyper-local content about their city, community, favourite spots, local events, neighbourhood energy — builds a sense of place and belonging.

Content field definitions:
- "hook": the opening line the creator should say on camera (for Reels) or the headline of the post (for Carousel/Static). This should be copy-pasteable spoken text.
- "body": the full spoken script for Reels, or the main body text for Carousel/Static. This should be copy-pasteable text the creator delivers or writes directly into the post. Do NOT include filming instructions here.
- "directions": filming, performance, or design directions. Tell the creator HOW to make the piece (e.g., shot type, energy, visuals, slide layout). This is NOT copy-pasteable post text.
- "cta": the closing call-to-action the creator should say or write.
- "caption": the social media caption to paste below the post, including hashtags if appropriate.
- "musicSuggestion": music or audio vibe for Reels.
- "duration": target length for Reels (e.g., "45-60 seconds") or read-time estimate for Carousels/Static.

The JSON schema must be:
{
  "weekStarting": "{{weekStarting}}",
  "days": [
    {
      "day": "{{firstDay}}",
      "format": "Reel",
      "bucket": "Local",
      "title": "...",
      "hook": "...",
      "body": "...",
      "cta": "...",
      "caption": "...",
      "directions": "...",
      "musicSuggestion": "...",
      "duration": "..."
    }
  ]
}

Days must be one of: {{targetDays}}.
Formats must be: Reel, Carousel, Static.
Buckets must be: Personal, Expert, Local.`;

const DEFAULT_CALENDAR_STRATEGY_PROMPT = `You are an elite personal brand content strategist. Write ONE concise "AI Strategy Note" (2-3 sentences max) for this creator's upcoming content calendar. It should read like a weekly strategy brief.

The note should explain the balance of content "buckets" for the week: local community content (builds belonging around their city), expert authority (showcases professional expertise), and personal storytelling (human/off-duty moments). Naturally weave in the buckets, format mix, and timing insight.

Calendar starts {{weekStarting}}.

FORMAT MIX:
{{formatMix}}

BUCKET MIX:
{{bucketMix}}

UPCOMING DAYS:
{{daySummary}}

The user's PRIMARY MARKETING GOAL is: {{primaryGoal}}.

VOCABULARY GUARDRAILS — never use these words/phrases in the note: {{antiBrandWords}}

Respond with ONLY the strategy note text — no headers, no bullet points, no markdown. Keep it under 180 words. Make it feel like a confident strategist wrote it for the creator. Reference the buckets using the exact phrases "local community content", "expert authority", and "personal storytelling" when possible so they can be visually highlighted.`;

interface ConfigFormProps {
  initial: {
    zernioApiKey: string | null;
    zernioEnabledPlatforms: string[];
    analyticsSyncFrequencyMinutes: number;
    anthropicModel: string;
    anthropicApiKey: string | null;
    insightPromptTemplate: string | null;
    calendarPromptTemplate: string | null;
    calendarStrategyPromptTemplate: string | null;
  };
  envZernioKey: boolean;
  envAnthropicKey: boolean;
  connectedAccounts: number;
}

export default function ConfigForm({
  initial,
  envZernioKey,
  envAnthropicKey,
  connectedAccounts,
}: ConfigFormProps) {
  const [zernioApiKey, setZernioApiKey] = useState(initial.zernioApiKey ?? "");
  const [enabledPlatforms, setEnabledPlatforms] = useState<string[]>(
    initial.zernioEnabledPlatforms
  );
  const [syncMinutes, setSyncMinutes] = useState(
    String(initial.analyticsSyncFrequencyMinutes)
  );
  const [anthropicModel, setAnthropicModel] = useState(initial.anthropicModel);
  const [anthropicApiKey, setAnthropicApiKey] = useState(
    initial.anthropicApiKey ?? ""
  );
  const [insightPrompt, setInsightPrompt] = useState(
    initial.insightPromptTemplate ?? ""
  );
  const [calendarPrompt, setCalendarPrompt] = useState(
    initial.calendarPromptTemplate ?? ""
  );
  const [calendarStrategyPrompt, setCalendarStrategyPrompt] = useState(
    initial.calendarStrategyPromptTemplate ?? ""
  );
  const [showZernioKey, setShowZernioKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [status, setStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);
  const [pending, startTransition] = useTransition();

  const togglePlatform = (platform: string) => {
    setEnabledPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updatePlatformConfig({
        zernioApiKey: zernioApiKey.trim() || null,
        zernioEnabledPlatforms: enabledPlatforms,
        analyticsSyncFrequencyMinutes: parseInt(syncMinutes, 10) || 60,
        anthropicModel: anthropicModel.trim() || "claude-opus-4-8",
        anthropicApiKey: anthropicApiKey.trim() || null,
        insightPromptTemplate: insightPrompt.trim() || null,
        calendarPromptTemplate: calendarPrompt.trim() || null,
        calendarStrategyPromptTemplate: calendarStrategyPrompt.trim() || null,
      });
      if (result.success) {
        setStatus({ type: "success", message: "Settings saved successfully." });
      } else {
        setStatus({
          type: "error",
          message: result.error ?? "Failed to save settings.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      {status && (
        <div
          className={`flex items-center gap-3 p-4 rounded-lg border ${
            status.type === "success"
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {status.type === "success" ? (
            <CheckCircle className="h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0" />
          )}
          <p className="text-sm font-medium">{status.message}</p>
        </div>
      )}

      {/* Zernio Section */}
      <section className="bg-[#111111] rounded-lg p-6 border border-[#1a1a1a] space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[#e8e8e8] mb-1">
            Zernio Social Analytics
          </h2>
          <p className="text-sm text-[#787878]">
            Configure the Zernio API key and which social platforms users can
            connect.
          </p>
        </div>

        {/* Zernio API Key */}
        <div>
          <label className="block text-sm font-medium text-[#e8e8e8] mb-1.5">
            Zernio API Key
          </label>
          <div className="flex items-center gap-2">
            <input
              type={showZernioKey ? "text" : "password"}
              value={zernioApiKey}
              onChange={(e) => setZernioApiKey(e.target.value)}
              placeholder={envZernioKey ? "Using ZERNIO_API_KEY from env" : "Enter API key…"}
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowZernioKey(!showZernioKey)}
              className="px-3 py-2 text-xs font-medium text-[#787878] hover:text-[#e8e8e8] bg-[#1a1a1a] rounded-md border border-[#2a2a2a]"
            >
              {showZernioKey ? "Hide" : "Show"}
            </button>
          </div>
          {envZernioKey && (
            <p className="text-xs text-[#555] mt-1.5">
              Env variable <code className="text-[#c8952a]">ZERNIO_API_KEY</code>{" "}
              is set — this field overrides it if filled.
            </p>
          )}
        </div>

        {/* Enabled Platforms */}
        <div>
          <label className="block text-sm font-medium text-[#e8e8e8] mb-2">
            Enabled Platforms
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => togglePlatform(p.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  enabledPlatforms.includes(p.value)
                    ? "bg-[#c8952a]/10 border-[#c8952a]/40 text-[#c8952a]"
                    : "bg-[#0a0a0a] border-[#2a2a2a] text-[#787878] hover:border-[#3a3a3a]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#555] mt-2">
            Only enabled platforms will appear on the Integrations page.
          </p>
        </div>

        {/* Sync Frequency */}
        <div>
          <label className="block text-sm font-medium text-[#e8e8e8] mb-1.5">
            Analytics Sync Frequency (minutes)
          </label>
          <input
            type="number"
            min={1}
            value={syncMinutes}
            onChange={(e) => setSyncMinutes(e.target.value)}
            className="w-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-[#e8e8e8] focus:border-[#c8952a] focus:outline-none"
          />
          <p className="text-xs text-[#555] mt-1.5">
            Minimum time between automatic analytics syncs per user. Users can
            still manually sync anytime.
          </p>
        </div>

        {/* Connected accounts info */}
        <div className="flex items-center gap-2 text-xs text-[#555]">
          <span className="px-2 py-1 bg-[#1a1a1a] rounded-md">
            {connectedAccounts} connected account
            {connectedAccounts !== 1 ? "s" : ""} across all users
          </span>
        </div>
      </section>

      {/* AI Provider Section */}
      <section className="bg-[#111111] rounded-lg p-6 border border-[#1a1a1a] space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[#e8e8e8] mb-1">
            AI Provider (Anthropic)
          </h2>
          <p className="text-sm text-[#787878]">
            Configure the Anthropic model, API key, and prompt templates used
            for calendar generation and analytics insights.
          </p>
        </div>

        {/* Anthropic Model */}
        <div>
          <label className="block text-sm font-medium text-[#e8e8e8] mb-1.5">
            Model Name
          </label>
          <input
            type="text"
            value={anthropicModel}
            onChange={(e) => setAnthropicModel(e.target.value)}
            placeholder="claude-opus-4-8"
            className="w-full max-w-md bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none"
          />
        </div>

        {/* Anthropic API Key */}
        <div>
          <label className="block text-sm font-medium text-[#e8e8e8] mb-1.5">
            Anthropic API Key
          </label>
          <div className="flex items-center gap-2">
            <input
              type={showAnthropicKey ? "text" : "password"}
              value={anthropicApiKey}
              onChange={(e) => setAnthropicApiKey(e.target.value)}
              placeholder={
                envAnthropicKey
                  ? "Using ANTHROPIC_API_KEY from env"
                  : "Enter API key…"
              }
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-sm text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowAnthropicKey(!showAnthropicKey)}
              className="px-3 py-2 text-xs font-medium text-[#787878] hover:text-[#e8e8e8] bg-[#1a1a1a] rounded-md border border-[#2a2a2a]"
            >
              {showAnthropicKey ? "Hide" : "Show"}
            </button>
          </div>
          {envAnthropicKey && (
            <p className="text-xs text-[#555] mt-1.5">
              Env variable{" "}
              <code className="text-[#c8952a]">ANTHROPIC_API_KEY</code> is set —
              this field overrides it if filled.
            </p>
          )}
        </div>

        {/* Insight Prompt Template */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#e8e8e8]">
              Insight Prompt Template
            </label>
            <button
              type="button"
              onClick={() => setInsightPrompt(DEFAULT_INSIGHT_PROMPT)}
              className="text-xs text-[#c8952a] hover:underline"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={insightPrompt}
            onChange={(e) => setInsightPrompt(e.target.value)}
            placeholder={DEFAULT_INSIGHT_PROMPT}
            rows={8}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-xs text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none font-mono resize-y"
          />
          <p className="text-xs text-[#555] mt-1.5">
            Template for AI insights shown on the Analytics dashboard. Use{" "}
            <code className="text-[#c8952a]">{"{{totalPosts}}"}</code>,{" "}
            <code className="text-[#c8952a]">{"{{totalViews}}"}</code>,{" "}
            <code className="text-[#c8952a]">{"{{avgEngagement}}"}</code>,{" "}
            <code className="text-[#c8952a]">{"{{viewsTrend}}"}</code>,{" "}
            <code className="text-[#c8952a]">{"{{formatSummary}}"}</code>,{" "}
            <code className="text-[#c8952a]">{"{{topPosts}}"}</code> as
            placeholders. Leave empty to use the built-in default.
          </p>
        </div>

        {/* Calendar Prompt Template */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#e8e8e8]">
              Calendar Prompt Template
            </label>
            <button
              type="button"
              onClick={() => setCalendarPrompt(DEFAULT_CALENDAR_PROMPT)}
              className="text-xs text-[#c8952a] hover:underline"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={calendarPrompt}
            onChange={(e) => setCalendarPrompt(e.target.value)}
            placeholder={DEFAULT_CALENDAR_PROMPT}
            rows={12}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-xs text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none font-mono resize-y"
          />
          <p className="text-xs text-[#555] mt-1.5">
            Template for weekly calendar generation. Placeholders:{" "}
            <code className="text-[#c8952a]">{"{{questionnaireAnswers}}"}</code>,
            <code className="text-[#c8952a]">{"{{usedTitlesBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{deepDiveBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{goalBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{guardrailBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{voiceBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{offerBlock}}"}</code>,
            <code className="text-[#c8952a]">{"{{daysToPost}}"}</code>,
            <code className="text-[#c8952a]">{"{{currentDay}}"}</code>,
            <code className="text-[#c8952a]">{"{{targetDays}}"}</code>,
            <code className="text-[#c8952a]">{"{{formatMix}}"}</code>,
            <code className="text-[#c8952a]">{"{{bucketDistribution}}"}</code>,
            <code className="text-[#c8952a]">{"{{weekStarting}}"}</code>,
            <code className="text-[#c8952a]">{"{{firstDay}}"}</code>. Leave empty
            to use the built-in default.
          </p>
        </div>

        {/* Calendar Strategy Prompt Template */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-[#e8e8e8]">
              Calendar Strategy Prompt Template
            </label>
            <button
              type="button"
              onClick={() => setCalendarStrategyPrompt(DEFAULT_CALENDAR_STRATEGY_PROMPT)}
              className="text-xs text-[#c8952a] hover:underline"
            >
              Reset to default
            </button>
          </div>
          <textarea
            value={calendarStrategyPrompt}
            onChange={(e) => setCalendarStrategyPrompt(e.target.value)}
            placeholder={DEFAULT_CALENDAR_STRATEGY_PROMPT}
            rows={12}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md px-3 py-2 text-xs text-[#e8e8e8] placeholder:text-[#555] focus:border-[#c8952a] focus:outline-none font-mono resize-y"
          />
          <p className="text-xs text-[#555] mt-1.5">
            Template for the AI Strategy Note shown on the Content Calendar page.
            Placeholders:{" "}
            <code className="text-[#c8952a]">{"{{weekStarting}}"}</code>,
            <code className="text-[#c8952a]">{"{{formatMix}}"}</code>,
            <code className="text-[#c8952a]">{"{{bucketMix}}"}</code>,
            <code className="text-[#c8952a]">{"{{daySummary}}"}</code>,
            <code className="text-[#c8952a]">{"{{primaryGoal}}"}</code>,
            <code className="text-[#c8952a]">{"{{antiBrandWords}}"}</code>. Leave empty
            to use the built-in default.
          </p>
        </div>
      </section>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={pending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "#c8952a", color: "#0a0a0a" }}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Settings
        </button>
      </div>
    </div>
  );
}
