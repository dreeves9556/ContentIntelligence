/**
 * Prompt placeholder replacement helpers for calendar and strategy generation.
 *
 * Extracted from `src/app/dashboard/calendar/actions.ts` so the placeholder
 * semantics can be unit-tested directly against the production helper instead
 * of a copied replica.
 *
 * Two replacement contexts:
 *  - Calendar generation: `replacePromptPlaceholders` replaces ALL supported
 *    placeholders in both the system prompt (custom template or default) and
 *    the user prompt (assembled context blocks). Stale block placeholders
 *    (deepDiveBlock, goalBlock, etc.) are replaced with empty strings so a
 *    custom template referencing them does not leak literal {{...}} text.
 *  - Strategy generation: `replaceStrategySystemPlaceholders` replaces the
 *    strategy-specific placeholders in the SYSTEM prompt only. The user prompt
 *    is always the assembled calendar data (never the template).
 *
 * Unknown placeholders are left as-is (literal {{...}} text). This is the
 * intended policy: an admin who typos a placeholder name sees the typo in the
 * generated prompt and can correct the template, rather than silently losing
 * the marker. Supported placeholders are listed below.
 */

export interface PromptPlaceholderContext {
  // Context blocks (assembled XML strings).
  questionnaireAnswers: string;
  usedTitlesBlock: string;
  bestTimesBlock: string;
  demographicsBlock: string;
  memoryBlock: string;
  performanceBlock: string;
  contentPerformanceBlock: string;
  followerTrendBlock: string;
  cadenceBlock: string;
  feedbackBlock: string;
  trendingTopicsBlock: string;

  // Scalar values.
  daysToPost: number;
  currentDay: string;
  targetDays: string[];
  formatMix: string;
  bucketDistribution: string;
  weekStarting: string;
}

/**
 * Replace all supported calendar placeholders in `text` using `ctx`.
 * Stale block placeholders (deepDiveBlock, goalBlock, guardrailBlock,
 * voiceBlock, offerBlock, audienceBlock, boundariesBlock,
 * personalContextBlock, formattingBlock) are replaced with empty strings.
 */
export function replacePromptPlaceholders(
  text: string,
  ctx: PromptPlaceholderContext
): string {
  return text
    .replace(/\{\{questionnaireAnswers\}\}/g, ctx.questionnaireAnswers)
    .replace(/\{\{usedTitlesBlock\}\}/g, ctx.usedTitlesBlock)
    .replace(/\{\{bestTimesBlock\}\}/g, ctx.bestTimesBlock)
    .replace(/\{\{demographicsBlock\}\}/g, ctx.demographicsBlock)
    .replace(/\{\{memoryBlock\}\}/g, ctx.memoryBlock)
    .replace(/\{\{performanceBlock\}\}/g, ctx.performanceBlock)
    .replace(/\{\{contentPerformanceBlock\}\}/g, ctx.contentPerformanceBlock)
    .replace(/\{\{followerTrendBlock\}\}/g, ctx.followerTrendBlock)
    .replace(/\{\{cadenceBlock\}\}/g, ctx.cadenceBlock)
    .replace(/\{\{feedbackBlock\}\}/g, ctx.feedbackBlock)
    .replace(/\{\{trendingTopicsBlock\}\}/g, ctx.trendingTopicsBlock)
    .replace(/\{\{deepDiveBlock\}\}/g, "")
    .replace(/\{\{goalBlock\}\}/g, "")
    .replace(/\{\{guardrailBlock\}\}/g, "")
    .replace(/\{\{voiceBlock\}\}/g, "")
    .replace(/\{\{offerBlock\}\}/g, "")
    .replace(/\{\{audienceBlock\}\}/g, "")
    .replace(/\{\{boundariesBlock\}\}/g, "")
    .replace(/\{\{personalContextBlock\}\}/g, "")
    .replace(/\{\{formattingBlock\}\}/g, "")
    .replace(/\{\{daysToPost\}\}/g, String(ctx.daysToPost))
    .replace(/\{\{currentDay\}\}/g, ctx.currentDay)
    .replace(/\{\{targetDays\}\}/g, ctx.targetDays.join(", "))
    .replace(/\{\{formatMix\}\}/g, ctx.formatMix)
    .replace(/\{\{bucketDistribution\}\}/g, ctx.bucketDistribution)
    .replace(/\{\{weekStarting\}\}/g, ctx.weekStarting)
    .replace(/\{\{firstDay\}\}/g, ctx.targetDays[0]);
}

export interface StrategyPlaceholderContext {
  weekStarting: string;
  formatMix: string;
  bucketMix: string;
  daySummary: string;
  primaryGoal: string;
  antiBrandWords: string;
}

/**
 * Replace strategy-specific placeholders in the SYSTEM prompt. The strategy
 * user prompt is always the assembled calendar data and is NOT processed here.
 */
export function replaceStrategySystemPlaceholders(
  text: string,
  ctx: StrategyPlaceholderContext
): string {
  return text
    .replace(/\{\{weekStarting\}\}/g, ctx.weekStarting)
    .replace(/\{\{formatMix\}\}/g, ctx.formatMix)
    .replace(/\{\{bucketMix\}\}/g, ctx.bucketMix)
    .replace(/\{\{daySummary\}\}/g, ctx.daySummary)
    .replace(/\{\{primaryGoal\}\}/g, ctx.primaryGoal)
    .replace(/\{\{antiBrandWords\}\}/g, ctx.antiBrandWords);
}
