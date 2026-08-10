// Tests for prompt placeholder replacement semantics.
// Run: npx tsx src/lib/__tests__/prompt-placeholder-semantics.test.ts
//
// Exercises the real `replacePromptPlaceholders` and
// `replaceStrategySystemPlaceholders` from src/lib/prompt-placeholders.ts.
// No algorithm is copied — the test drives the production helpers.

import {
  replacePromptPlaceholders,
  replaceStrategySystemPlaceholders,
  type PromptPlaceholderContext,
  type StrategyPlaceholderContext,
} from "../prompt-placeholders";

let failures = 0;
function assert(condition: boolean, label: string): void {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    failures++;
  }
}

function makeCtx(overrides: Partial<PromptPlaceholderContext> = {}): PromptPlaceholderContext {
  return {
    questionnaireAnswers: "<questionnaire>answers</questionnaire>",
    usedTitlesBlock: "<usedTitles>title1</usedTitles>",
    bestTimesBlock: "<bestTimes>9am</bestTimes>",
    demographicsBlock: "<demographics>data</demographics>",
    memoryBlock: "<memory>mem1</memory>",
    performanceBlock: "<performance>perf</performance>",
    contentPerformanceBlock: "<contentPerf>cp</contentPerf>",
    followerTrendBlock: "<followerTrend>up</followerTrend>",
    cadenceBlock: "<cadence>3x/week</cadence>",
    feedbackBlock: "<feedback>good</feedback>",
    trendingTopicsBlock: "<trending>topic1</trending>",
    daysToPost: 3,
    currentDay: "Monday",
    targetDays: ["Monday", "Wednesday", "Friday"],
    formatMix: "- VIDEO: 1\n- CAROUSEL: 1\n- TEXT: 1",
    bucketDistribution: "- EDUCATE: 2\n- ENGAGE: 1",
    weekStarting: "2026-08-08",
    ...overrides,
  };
}

function makeStrategyCtx(overrides: Partial<StrategyPlaceholderContext> = {}): StrategyPlaceholderContext {
  return {
    weekStarting: "2026-08-08",
    formatMix: "- VIDEO: 1\n- CAROUSEL: 1",
    bucketMix: "- EDUCATE: 2\n- ENGAGE: 1",
    daySummary: "Day 1: VIDEO\nDay 2: CAROUSEL",
    primaryGoal: "Grow audience",
    antiBrandWords: "spam, clickbait",
    ...overrides,
  };
}

// ─── Calendar placeholder tests ───────────────────────────────────────────

function testAllCalendarPlaceholdersReplaced() {
  const ctx = makeCtx();
  const template = `System: {{questionnaireAnswers}} {{usedTitlesBlock}} {{bestTimesBlock}} {{demographicsBlock}} {{memoryBlock}} {{performanceBlock}} {{contentPerformanceBlock}} {{followerTrendBlock}} {{cadenceBlock}} {{feedbackBlock}} {{trendingTopicsBlock}} {{daysToPost}} {{currentDay}} {{targetDays}} {{formatMix}} {{bucketDistribution}} {{weekStarting}} {{firstDay}}`;
  const result = replacePromptPlaceholders(template, ctx);
  assert(!result.includes("{{"), "no placeholders remain in calendar template");
  assert(result.includes("<questionnaire>answers</questionnaire>"), "questionnaireAnswers replaced");
  assert(result.includes("<usedTitles>title1</usedTitles>"), "usedTitlesBlock replaced");
  assert(result.includes("3"), "daysToPost replaced");
  assert(result.includes("Monday, Wednesday, Friday"), "targetDays replaced");
  assert(result.includes("Monday"), "firstDay replaced (targetDays[0])");
}

function testStaleBlockPlaceholdersEmptied() {
  const ctx = makeCtx();
  const template = `{{deepDiveBlock}}{{goalBlock}}{{guardrailBlock}}{{voiceBlock}}{{offerBlock}}{{audienceBlock}}{{boundariesBlock}}{{personalContextBlock}}{{formattingBlock}}`;
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === "", "all stale block placeholders replaced with empty string");
}

function testCustomTemplateReplacesSystemOnly() {
  const ctx = makeCtx();
  const customSystem = "Custom: {{daysToPost}} days, {{weekStarting}}";
  const userPrompt = "User: {{questionnaireAnswers}}";
  const systemResult = replacePromptPlaceholders(customSystem, ctx);
  const userResult = replacePromptPlaceholders(userPrompt, ctx);
  assert(systemResult === "Custom: 3 days, 2026-08-08", "custom system template placeholders replaced");
  assert(userResult === "User: <questionnaire>answers</questionnaire>", "user prompt placeholders replaced");
}

function testUnknownPlaceholderLeftAsIs() {
  const ctx = makeCtx();
  const template = "Hello {{unknownPlaceholder}} world";
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === "Hello {{unknownPlaceholder}} world", "unknown placeholder left as-is");
}

function testMultipleOccurrencesReplaced() {
  const ctx = makeCtx();
  const template = "{{daysToPost}} and {{daysToPost}} and {{daysToPost}}";
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === "3 and 3 and 3", "multiple occurrences of same placeholder replaced");
}

function testEmptyTargetDays() {
  const ctx = makeCtx({ targetDays: [] });
  const template = "{{targetDays}} {{firstDay}}";
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === " undefined", "empty targetDays → firstDay is undefined (edge case)");
}

function testZeroDaysToPost() {
  const ctx = makeCtx({ daysToPost: 0 });
  const template = "{{daysToPost}}";
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === "0", "zero daysToPost replaced as '0'");
}

function testNoPlaceholders() {
  const ctx = makeCtx();
  const template = "No placeholders here";
  const result = replacePromptPlaceholders(template, ctx);
  assert(result === "No placeholders here", "text without placeholders unchanged");
}

function testEmptyString() {
  const ctx = makeCtx();
  const result = replacePromptPlaceholders("", ctx);
  assert(result === "", "empty string unchanged");
}

// ─── Strategy placeholder tests ───────────────────────────────────────────

function testAllStrategyPlaceholdersReplaced() {
  const ctx = makeStrategyCtx();
  const template = `Week: {{weekStarting}} Mix: {{formatMix}} Buckets: {{bucketMix}} Summary: {{daySummary}} Goal: {{primaryGoal}} Avoid: {{antiBrandWords}}`;
  const result = replaceStrategySystemPlaceholders(template, ctx);
  assert(!result.includes("{{"), "no placeholders remain in strategy template");
  assert(result.includes("2026-08-08"), "weekStarting replaced");
  assert(result.includes("Grow audience"), "primaryGoal replaced");
  assert(result.includes("spam, clickbait"), "antiBrandWords replaced");
}

function testStrategyUnknownPlaceholderLeftAsIs() {
  const ctx = makeStrategyCtx();
  const template = "{{questionnaireAnswers}} should remain";
  const result = replaceStrategySystemPlaceholders(template, ctx);
  assert(result === "{{questionnaireAnswers}} should remain", "calendar placeholder not replaced by strategy helper");
}

function testStrategyEmptyPrimaryGoal() {
  const ctx = makeStrategyCtx({ primaryGoal: "" });
  const template = "Goal: {{primaryGoal}}";
  const result = replaceStrategySystemPlaceholders(template, ctx);
  assert(result === "Goal: ", "empty primaryGoal replaced with empty string");
}

// ─── Run ──────────────────────────────────────────────────────────────────

function main() {
  testAllCalendarPlaceholdersReplaced();
  testStaleBlockPlaceholdersEmptied();
  testCustomTemplateReplacesSystemOnly();
  testUnknownPlaceholderLeftAsIs();
  testMultipleOccurrencesReplaced();
  testEmptyTargetDays();
  testZeroDaysToPost();
  testNoPlaceholders();
  testEmptyString();
  testAllStrategyPlaceholdersReplaced();
  testStrategyUnknownPlaceholderLeftAsIs();
  testStrategyEmptyPrimaryGoal();

  if (failures > 0) {
    console.error(`\n${failures} test(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log("All prompt-placeholder-semantics tests passed.");
  }
}

main();
