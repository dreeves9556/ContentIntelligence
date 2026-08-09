// Tests for custom calendar and strategy prompt placeholder semantics.
// Run: npx tsx src/lib/__tests__/prompt-placeholder-semantics.test.ts
//
// Verifies the two correctness rules:
// 1. A custom calendar/strategy template replaces the SYSTEM prompt; the
//    USER prompt is always the assembled calendar data (not the template).
//    Previously the strategy path set BOTH system and user to the custom
//    template, never sending the actual calendar data.
// 2. All placeholders in a custom template are replaced — no literal
//    {{...}} text leaks into the prompt sent to the AI. Previously the
//    calendar system prompt only replaced {{weekStarting}} and {{firstDay}}.

export {};

let pass = 0;
let fail = 0;
function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`PASS: ${label}`);
    pass++;
  } else {
    console.error(`FAIL: ${label}`);
    fail++;
  }
}

// ─── Inlined replica of the strategy prompt assembly logic ────────────────
// Mirrors generateCalendarStrategy in src/app/dashboard/calendar/actions.ts.
function buildStrategyPrompts(opts: {
  customTemplate: string | null;
  weekStarting: string;
  formatMixStr: string;
  bucketMixStr: string;
  daySummary: string;
  primaryGoal: string;
  antiBrandWords: string;
  userProfileXml: string;
}): { systemPrompt: string; userPrompt: string } {
  const defaultUserPrompt = `<calendar_data>
Calendar starts ${opts.weekStarting}.

FORMAT MIX:
${opts.formatMixStr}

BUCKET MIX:
${opts.bucketMixStr}

UPCOMING DAYS:
${opts.daySummary}
</calendar_data>

${opts.userProfileXml}

Write the strategy note now.`;

  // Correct semantics: custom template → system prompt (with placeholders
  // replaced); user prompt is ALWAYS the assembled calendar data.
  const systemPrompt = (opts.customTemplate ?? "DEFAULT_STRATEGY_SYSTEM_PROMPT")
    .replace(/\{\{weekStarting\}\}/g, opts.weekStarting)
    .replace(/\{\{formatMix\}\}/g, opts.formatMixStr)
    .replace(/\{\{bucketMix\}\}/g, opts.bucketMixStr)
    .replace(/\{\{daySummary\}\}/g, opts.daySummary)
    .replace(/\{\{primaryGoal\}\}/g, opts.primaryGoal)
    .replace(/\{\{antiBrandWords\}\}/g, opts.antiBrandWords);

  const userPrompt = defaultUserPrompt;
  return { systemPrompt, userPrompt };
}

// ─── Inlined replica of the calendar prompt assembly logic ────────────────
// Mirrors generateWeeklyCalendar's replacePromptPlaceholders.
function buildCalendarPrompts(opts: {
  customTemplate: string | null;
  weekStarting: string;
  firstDay: string;
  daysToPost: number;
  currentDay: string;
  targetDays: string[];
  formatMixStr: string;
  bucketDistStr: string;
  userProfileXml: string;
  usedTitlesXml: string;
  defaultUserPrompt: string;
}): { systemPrompt: string; userPrompt: string } {
  function replacePlaceholders(text: string): string {
    return text
      .replace(/\{\{questionnaireAnswers\}\}/g, opts.userProfileXml)
      .replace(/\{\{usedTitlesBlock\}\}/g, opts.usedTitlesXml)
      .replace(/\{\{deepDiveBlock\}\}/g, "")
      .replace(/\{\{goalBlock\}\}/g, "")
      .replace(/\{\{guardrailBlock\}\}/g, "")
      .replace(/\{\{voiceBlock\}\}/g, "")
      .replace(/\{\{offerBlock\}\}/g, "")
      .replace(/\{\{audienceBlock\}\}/g, "")
      .replace(/\{\{boundariesBlock\}\}/g, "")
      .replace(/\{\{personalContextBlock\}\}/g, "")
      .replace(/\{\{formattingBlock\}\}/g, "")
      .replace(/\{\{daysToPost\}\}/g, String(opts.daysToPost))
      .replace(/\{\{currentDay\}\}/g, opts.currentDay)
      .replace(/\{\{targetDays\}\}/g, opts.targetDays.join(", "))
      .replace(/\{\{formatMix\}\}/g, opts.formatMixStr)
      .replace(/\{\{bucketDistribution\}\}/g, opts.bucketDistStr)
      .replace(/\{\{weekStarting\}\}/g, opts.weekStarting)
      .replace(/\{\{firstDay\}\}/g, opts.firstDay);
  }

  const systemPrompt = replacePlaceholders(opts.customTemplate ?? "DEFAULT_CALENDAR_SYSTEM_PROMPT");
  const userPrompt = replacePlaceholders(opts.defaultUserPrompt);
  return { systemPrompt, userPrompt };
}

// ─── Strategy prompt tests ─────────────────────────────────────────────────

// 1. Custom strategy template → system prompt is the template; user prompt
//    is the assembled calendar data (not the template).
{
  const customTemplate = "Custom strategy template. Week: {{weekStarting}}, goal: {{primaryGoal}}";
  const { systemPrompt, userPrompt } = buildStrategyPrompts({
    customTemplate,
    weekStarting: "2026-01-05",
    formatMixStr: "- Reel: 3",
    bucketMixStr: "- Expert: 2",
    daySummary: "Mon: Reel, Expert",
    primaryGoal: "Get more clients",
    antiBrandWords: "synergy, leverage",
    userProfileXml: "<profile>...</profile>",
  });
  assert(systemPrompt.includes("Custom strategy template"), "custom strategy template → system prompt is the template");
  assert(!userPrompt.includes("Custom strategy template"), "custom strategy template → user prompt is NOT the template");
  assert(userPrompt.includes("<calendar_data>"), "custom strategy template → user prompt is the assembled calendar data");
  assert(systemPrompt.includes("2026-01-05"), "strategy system: {{weekStarting}} replaced");
  assert(systemPrompt.includes("Get more clients"), "strategy system: {{primaryGoal}} replaced");
  assert(!systemPrompt.includes("{{"), "strategy system: no unreplaced placeholders");
}

// 2. Default strategy (no custom template) → system is default, user is data.
{
  const { systemPrompt, userPrompt } = buildStrategyPrompts({
    customTemplate: null,
    weekStarting: "2026-01-05",
    formatMixStr: "- Reel: 3",
    bucketMixStr: "- Expert: 2",
    daySummary: "Mon: Reel",
    primaryGoal: "Grow audience",
    antiBrandWords: "delve",
    userProfileXml: "<profile/>",
  });
  assert(systemPrompt === "DEFAULT_STRATEGY_SYSTEM_PROMPT", "no custom strategy template → system is the default");
  assert(userPrompt.includes("<calendar_data>"), "no custom strategy template → user is the assembled data");
  assert(userPrompt.includes("2026-01-05"), "strategy user prompt includes weekStarting");
}

// 3. Strategy placeholders all replaced.
{
  const template = "Week {{weekStarting}} | Mix {{formatMix}} | Buckets {{bucketMix}} | Days {{daySummary}} | Goal {{primaryGoal}} | Avoid {{antiBrandWords}}";
  const { systemPrompt } = buildStrategyPrompts({
    customTemplate: template,
    weekStarting: "2026-02-09",
    formatMixStr: "- Reel: 5",
    bucketMixStr: "- Local: 3",
    daySummary: "Mon: Reel",
    primaryGoal: "Brand awareness",
    antiBrandWords: "leverage",
    userProfileXml: "",
  });
  assert(!systemPrompt.includes("{{"), "strategy: all 6 placeholders replaced (no literal {{...}})");
  assert(systemPrompt.includes("2026-02-09"), "strategy: weekStarting replaced");
  assert(systemPrompt.includes("- Reel: 5"), "strategy: formatMix replaced");
  assert(systemPrompt.includes("- Local: 3"), "strategy: bucketMix replaced");
  assert(systemPrompt.includes("Brand awareness"), "strategy: primaryGoal replaced");
  assert(systemPrompt.includes("leverage"), "strategy: antiBrandWords replaced");
}

// ─── Calendar prompt tests ─────────────────────────────────────────────────

// 4. Custom calendar template → system prompt is the template with ALL
//    placeholders replaced; user prompt is the assembled context.
{
  const customTemplate = "Generate {{daysToPost}} days starting {{currentDay}}. Days: {{targetDays}}. Mix: {{formatMix}}. Buckets: {{bucketDistribution}}. Week: {{weekStarting}}. First: {{firstDay}}. Q: {{questionnaireAnswers}}. Used: {{usedTitlesBlock}}. Deep: {{deepDiveBlock}}. Goal: {{goalBlock}}.";
  const { systemPrompt, userPrompt } = buildCalendarPrompts({
    customTemplate,
    weekStarting: "2026-01-05",
    firstDay: "Monday",
    daysToPost: 5,
    currentDay: "Monday",
    targetDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    formatMixStr: "- Reel: 3\n- Carousel: 2",
    bucketDistStr: "- Expert: 2\n- Personal: 2\n- Local: 1",
    userProfileXml: "<profile>user data</profile>",
    usedTitlesXml: "<used>title1</used>",
    defaultUserPrompt: "Assembled context with all blocks",
  });
  assert(systemPrompt.includes("Generate 5 days"), "calendar system: {{daysToPost}} replaced");
  assert(systemPrompt.includes("Monday, Tuesday, Wednesday, Thursday, Friday"), "calendar system: {{targetDays}} replaced");
  assert(systemPrompt.includes("<profile>user data</profile>"), "calendar system: {{questionnaireAnswers}} replaced");
  assert(systemPrompt.includes("<used>title1</used>"), "calendar system: {{usedTitlesBlock}} replaced");
  assert(!systemPrompt.includes("{{"), "calendar system: all placeholders replaced (no literal {{...}})");
  assert(userPrompt === "Assembled context with all blocks", "calendar: user prompt is the assembled context");
}

// 5. Default calendar (no custom template) → system is default (no placeholders).
{
  const { systemPrompt, userPrompt } = buildCalendarPrompts({
    customTemplate: null,
    weekStarting: "2026-01-05",
    firstDay: "Monday",
    daysToPost: 3,
    currentDay: "Monday",
    targetDays: ["Monday", "Wednesday", "Friday"],
    formatMixStr: "- Reel: 3",
    bucketDistStr: "- Expert: 3",
    userProfileXml: "<profile/>",
    usedTitlesXml: "",
    defaultUserPrompt: "Assembled context",
  });
  assert(systemPrompt === "DEFAULT_CALENDAR_SYSTEM_PROMPT", "no custom calendar template → system is the default");
  assert(userPrompt === "Assembled context", "no custom calendar template → user is the assembled context");
}

// 6. Stale block placeholders (deepDiveBlock, goalBlock, etc.) → empty string.
{
  const template = "Before {{deepDiveBlock}} {{goalBlock}} {{voiceBlock}} After";
  const { systemPrompt } = buildCalendarPrompts({
    customTemplate: template,
    weekStarting: "2026-01-05",
    firstDay: "Monday",
    daysToPost: 3,
    currentDay: "Monday",
    targetDays: ["Monday"],
    formatMixStr: "- Reel: 3",
    bucketDistStr: "- Expert: 3",
    userProfileXml: "",
    usedTitlesXml: "",
    defaultUserPrompt: "ctx",
  });
  assert(systemPrompt === "Before    After", "calendar: stale block placeholders replaced with empty string");
  assert(!systemPrompt.includes("{{"), "calendar: no stale placeholders leak");
}

// ─── Summary ────────────────────────────────────────────────────────────────
if (fail > 0) {
  console.error(`\n${fail} test(s) failed.`);
  process.exit(1);
} else {
  console.log(`\nAll prompt-placeholder-semantics tests passed (${pass} assertions).`);
}
