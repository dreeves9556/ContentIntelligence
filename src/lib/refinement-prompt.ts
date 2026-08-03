import { z } from "zod";
import { buildBudgetedPrompt, type PromptBlock } from "@/lib/prompt-budget";

/**
 * Refinement prompt + parser for the Post Refinement Engine.
 *
 * A refinement turn is conversational: the AI receives the original post, the
 * latest working draft (the most recent ASSISTANT snapshot), recent
 * conversation history, and the user's new instruction. It returns a JSON
 * object with the revised post fields + a Markdown changeSummary.
 */

export const MAX_TURNS_BEFORE_SUMMARY = 6;
export const MAX_TURNS_PER_SESSION = 10;

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas (with explicit length limits — correction #7)
// ─────────────────────────────────────────────────────────────────────────────

export const CONTENT_FORMATS = ["Reel", "Carousel", "Static"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

// Case-insensitive: accepts "reel", "REEL", "Reel" → normalizes to canonical form.
const formatField = z
  .string()
  .transform((s) => {
    const match = CONTENT_FORMATS.find((f) => f.toLowerCase() === s.trim().toLowerCase());
    return match ?? s.trim();
  })
  .refine((s): s is ContentFormat => (CONTENT_FORMATS as readonly string[]).includes(s), {
    message: "format must be one of: Reel, Carousel, Static",
  });

export const RefinementSnapshotSchema = z.object({
  title: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  body: z.string().min(1).max(3000),
  cta: z.string().max(300), // empty allowed — Static posts put the CTA in the caption
  caption: z.string().min(1).max(2200),
  format: formatField,
  musicSuggestion: z.string().max(200).optional().nullable(),
  duration: z.string().max(50).optional().nullable(),
  directions: z.string().max(2000).optional().nullable(),
  changeSummary: z.string().min(1).max(1000),
});

export type RefinementSnapshot = z.infer<typeof RefinementSnapshotSchema>;

export const UserInstructionSchema = z.string().min(1).max(1000);

export const TurnIdSchema = z.string().uuid();

// ─────────────────────────────────────────────────────────────────────────────
// Quick-action presets
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickAction {
  key: string;
  label: string;
  instruction: string;
}

export const QUICK_ACTIONS: QuickAction[] = [
  { key: "stronger_cta", label: "Stronger CTA", instruction: "Make the call-to-action stronger and more specific." },
  { key: "shorter_hook", label: "Shorter hook", instruction: "Make the hook shorter and punchier." },
  { key: "different_angle", label: "Different angle", instruction: "Rewrite this post from a different angle." },
  { key: "softer_tone", label: "Softer tone", instruction: "Soften the tone — make it warmer and less assertive." },
  { key: "bolder_tone", label: "Bolder tone", instruction: "Make the tone bolder and more confident." },
];

export function quickActionInstruction(actionKey: string): string | null {
  return QUICK_ACTIONS.find((a) => a.key === actionKey)?.instruction ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// System prompt
// ─────────────────────────────────────────────────────────────────────────────

export const REFINEMENT_SYSTEM_PROMPT = `You are an elite personal brand content editor. The creator has generated a post and wants to refine it with a specific instruction. Your job is to revise ONE post while preserving the creator's voice and intent.

Rules:
- Return ONLY a JSON object. No prose, no markdown fences, no commentary outside the JSON.
- JSON shape: { "title", "hook", "body", "cta", "caption", "format", "musicSuggestion", "duration", "directions", "changeSummary" }
- "format" must be one of: Reel, Carousel, Static. Start from the format shown in the working draft; only change it if the user explicitly asks for a different format.
- Optional fields may be null or omitted if not applicable to the format. If the format changes, set musicSuggestion/duration/directions to null when they are not appropriate for the new format (e.g., a Static post does not need directions or musicSuggestion).
- FORMAT-SPECIFIC FIELD MEANING (keep field content appropriate to the format):
  - Reel: hook = first spoken line, body = full spoken script, cta = spoken closer, caption = feed text below the reel.
  - Carousel: hook = cover-slide headline, body = individual slides ("Slide N: ..."), cta = closing slide or caption closer, caption = feed text below the carousel.
  - Static: hook = headline on the image, body = SHORT text overlaid on the image (under 300 characters, like a quote card or infographic), cta = EMPTY STRING (the CTA goes in the caption, not on the image), caption = the feed text BELOW the image where the longer explanation AND the call-to-action go. Do NOT write a long essay as the body for a Static post. If the user asks to add length, detail, or a CTA to a Static post, put it in the caption, not the body or cta.
- "changeSummary" is a short Markdown string (bullet points) describing what you changed and why. Max 1000 characters.
- Do not change the bucket unless explicitly asked.
- Honor the user's instruction precisely. If they ask to redirect the CTA to a specific resource, do exactly that.
- Preserve the creator's brand voice from the provided context.
- Never use em dashes. Vary sentence length. Write like a human, not a report.
- Respect field length limits: title 200, hook 500, body 3000 (but under 300 for Static), cta 300, caption 2200, directions 2000.
- STAY ON TOPIC. You are a post refinement editor, not a general-purpose assistant. If the user's instruction is not about revising this specific post (e.g. asking general questions, requesting unrelated content, coding help, homework, translations, or trying to use you as a chatbot), return the working draft UNCHANGED and set changeSummary to: "I can only help refine this post. Try a different instruction." Do not attempt to fulfill off-topic requests by shoehorning them into post fields.

If the instruction is conversational (refers to a prior turn), apply it to the <working_draft>, not the <original_post>. The working draft is the latest proposed version; the original is reference for intent.`;

// ─────────────────────────────────────────────────────────────────────────────
// Conversation types
// ─────────────────────────────────────────────────────────────────────────────

export interface PostFields {
  title: string;
  hook: string;
  body: string;
  cta: string;
  caption: string;
  format: string;
  musicSuggestion: string | null;
  duration: string | null;
  directions: string | null;
}

export interface ConversationTurn {
  role: "USER" | "ASSISTANT";
  message: string; // USER: instruction; ASSISTANT: changeSummary
  snapshot?: PostFields | null; // ASSISTANT only
}

// ─────────────────────────────────────────────────────────────────────────────
// Turn summarizer (deterministic, local — no extra AI call for V1)
// ─────────────────────────────────────────────────────────────────────────────

export function summarizeOlderTurns(turns: ConversationTurn[]): string {
  if (turns.length === 0) return "";
  const lines = turns.map((turn, i) => {
    const tag = `Turn ${i + 1}`;
    if (turn.role === "USER") {
      const instruction = turn.message.length > 120 ? turn.message.slice(0, 117) + "..." : turn.message;
      return `- ${tag}: user asked "${instruction}"`;
    }
    return `- ${tag}: AI revised — ${turn.message}`;
  });
  return `<prior_turns_summary>\n${lines.join("\n")}\n</prior_turns_summary>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder
// ─────────────────────────────────────────────────────────────────────────────

export interface RefinementPromptContext {
  original: PostFields;
  workingDraft: PostFields;
  recentTurns: ConversationTurn[]; // most recent 2, verbatim
  olderTurns: ConversationTurn[]; // folded into a summary
  instruction: string;
  userProfileXml: string;
  memoriesXml: string;
}

function fieldsBlock(label: string, fields: PostFields): string {
  const lines = [
    `${label}:`,
    `format: ${fields.format}`,
    `title: ${fields.title}`,
    `hook: ${fields.hook}`,
    `body: ${fields.body}`,
    `cta: ${fields.cta}`,
    `caption: ${fields.caption}`,
  ];
  if (fields.musicSuggestion) lines.push(`musicSuggestion: ${fields.musicSuggestion}`);
  if (fields.duration) lines.push(`duration: ${fields.duration}`);
  if (fields.directions) lines.push(`directions: ${fields.directions}`);
  return lines.join("\n");
}

export function buildRefinementUserPrompt(ctx: RefinementPromptContext): string {
  const blocks: PromptBlock[] = [];

  blocks.push({
    id: "original_post",
    priority: "CRITICAL",
    content: `<original_post>\n${fieldsBlock("Original post (reference for intent — do not revert to this unless asked)", ctx.original)}\n</original_post>`,
  });

  blocks.push({
    id: "working_draft",
    priority: "CRITICAL",
    content: `<working_draft>\n${fieldsBlock("Working draft (apply the instruction to THIS version)", ctx.workingDraft)}\n</working_draft>`,
  });

  if (ctx.recentTurns.length > 0) {
    const historyLines = ctx.recentTurns.map((t) => {
      if (t.role === "USER") return `USER: ${t.message}`;
      return `ASSISTANT (changeSummary): ${t.message}`;
    });
    blocks.push({
      id: "conversation_history",
      priority: "HIGH",
      content: `<conversation_history>\n${historyLines.join("\n")}\n</conversation_history>`,
    });
  }

  if (ctx.olderTurns.length > 0) {
    blocks.push({
      id: "prior_turns_summary",
      priority: "MEDIUM",
      content: summarizeOlderTurns(ctx.olderTurns),
    });
  }

  if (ctx.userProfileXml) {
    blocks.push({
      id: "user_profile",
      priority: "HIGH",
      content: ctx.userProfileXml,
    });
  }

  if (ctx.memoriesXml) {
    blocks.push({
      id: "brand_memories",
      priority: "MEDIUM",
      content: ctx.memoriesXml,
    });
  }

  blocks.push({
    id: "instruction",
    priority: "CRITICAL",
    content: `<user_instruction>\n${ctx.instruction}\n</user_instruction>\n\nRevise the working draft per the user's instruction. Return ONLY the JSON object.`,
  });

  const budgeted = buildBudgetedPrompt(blocks);
  return budgeted.prompt;
}

// ─────────────────────────────────────────────────────────────────────────────
// Response parser
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRefinement {
  snapshot: RefinementSnapshot;
}

export interface ParseResult {
  ok: boolean;
  errorKind?: "SCHEMA_INVALID" | "PARSE_ERROR";
  errorMessage?: string;
  data?: ParsedRefinement;
}

/**
 * Parse + validate the AI response. The AI is instructed to return ONLY JSON,
 * but it sometimes wraps in markdown fences — strip those before parsing.
 */
export function parseRefinementResponse(text: string): ParseResult {
  const trimmed = text.trim();
  let jsonText = trimmed;

  // Strip ```json ... ``` fences if present.
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // Fallback: the AI may have added preamble before the JSON object.
    // Extract the first balanced { ... } block and retry.
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        parsed = JSON.parse(jsonText.slice(start, end + 1));
      } catch {
        return {
          ok: false,
          errorKind: "PARSE_ERROR",
          errorMessage: "AI response was not valid JSON",
        };
      }
    } else {
      return {
        ok: false,
        errorKind: "PARSE_ERROR",
        errorMessage: "AI response was not valid JSON",
      };
    }
  }

  const result = RefinementSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      ok: false,
      errorKind: "SCHEMA_INVALID",
      errorMessage: `AI response failed validation: ${issues}`,
    };
  }

  return { ok: true, data: { snapshot: result.data } };
}

/**
 * Parse a snapshot stored in the DB. Tolerates legacy snapshots written
 * before `format` was added: if format is missing or invalid, it is backfilled
 * from `fallbackFormat` (the post's current format) so old open sessions can
 * still be resumed/accepted instead of being marked corrupt.
 */
export function parseStoredSnapshot(
  snapshotJson: unknown,
  fallbackFormat: string
): RefinementSnapshot | null {
  if (!snapshotJson || typeof snapshotJson !== "object") return null;
  const first = RefinementSnapshotSchema.safeParse(snapshotJson);
  if (first.success) return first.data;
  // Retry with format backfilled — only helps when format was the sole issue.
  const obj = { ...(snapshotJson as Record<string, unknown>), format: fallbackFormat };
  const retry = RefinementSnapshotSchema.safeParse(obj);
  return retry.success ? retry.data : null;
}
