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

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas (with explicit length limits — correction #7)
// ─────────────────────────────────────────────────────────────────────────────

export const RefinementSnapshotSchema = z.object({
  title: z.string().min(1).max(200),
  hook: z.string().min(1).max(500),
  body: z.string().min(1).max(3000),
  cta: z.string().min(1).max(300),
  caption: z.string().min(1).max(2200),
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
- JSON shape: { "title", "hook", "body", "cta", "caption", "musicSuggestion", "duration", "directions", "changeSummary" }
- Optional fields may be null or omitted if not applicable to the format.
- "changeSummary" is a short Markdown string (bullet points) describing what you changed and why. Max 1000 characters.
- Keep the same format (Reel/Carousel/Static). Do not change the bucket unless explicitly asked.
- Honor the user's instruction precisely. If they ask to redirect the CTA to a specific resource, do exactly that.
- Preserve the creator's brand voice from the provided context.
- Never use em dashes. Vary sentence length. Write like a human, not a report.
- Respect field length limits: title 200, hook 500, body 3000, cta 300, caption 2200, directions 2000.

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
