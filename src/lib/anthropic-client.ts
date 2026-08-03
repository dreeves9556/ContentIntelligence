/**
 * Shared Anthropic API client.
 *
 * Centralizes the raw fetch logic previously duplicated across calendar,
 * insight, announcements, and impact callers. Core V1 refinement uses this;
 * migrating existing callers is out of scope.
 *
 * Idempotency note: this client does NOT send a custom x-request-id header.
 * Provider-side request correlation is not part of our idempotency model.
 * Turn-level idempotency is enforced by the PostRefinementTurn table and the
 * application-level turn state machine. turnId lives in app logs + DB only.
 */

export type AnthropicErrorKind =
  | "TIMEOUT"
  | "PROVIDER_ERROR"
  | "PARSE_ERROR"
  | "NETWORK_ERROR";

export interface AnthropicCallParams {
  apiKey: string;
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  timeoutMs?: number;
}

export interface AnthropicSuccess {
  ok: true;
  text: string;
  stopReason: string | null;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  model: string;
}

export interface AnthropicFailure {
  ok: false;
  errorKind: AnthropicErrorKind;
  errorMessage: string;
  status?: number;
}

export type AnthropicResult = AnthropicSuccess | AnthropicFailure;

const DEFAULT_TIMEOUT_MS = 60_000;

export async function callAnthropic(
  params: AnthropicCallParams
): Promise<AnthropicResult> {
  const { apiKey, model, system, messages, maxTokens, timeoutMs = DEFAULT_TIMEOUT_MS } = params;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Log full body server-side for diagnostics; do not leak to the client.
      console.error("Anthropic API error:", response.status, body);
      return {
        ok: false,
        errorKind: "PROVIDER_ERROR",
        errorMessage: `AI service error (${response.status})`,
        status: response.status,
      };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    const stopReason: string | null = data.stop_reason ?? null;
    const usage = data.usage ?? {};
    const promptTokens: number = usage.input_tokens ?? 0;
    const completionTokens: number = usage.output_tokens ?? 0;

    return {
      ok: true,
      text,
      stopReason,
      promptTokens,
      completionTokens,
      latencyMs,
      model,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorKind: "TIMEOUT",
        errorMessage: `AI request timed out after ${timeoutMs}ms`,
      };
    }
    console.error("Anthropic network error:", error, `(${latencyMs}ms)`);
    return {
      ok: false,
      errorKind: "NETWORK_ERROR",
      errorMessage: error instanceof Error ? error.message : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Per-model pricing in microdollars per token (1 microdollar = 1e-6 USD).
 * $1 per 1M tokens = 1 microdollar per token.
 *
 * Source: Anthropic public pricing. Update when models change.
 * Unknown models fall back to the most expensive known tier (conservative).
 */
const PRICE_TABLE_MICRODOLLARS_PER_TOKEN: Record<
  string,
  { input: number; output: number }
> = {
  // Claude 4 Opus
  "claude-opus-4-8": { input: 15, output: 75 },
  "claude-opus-4-5": { input: 15, output: 75 },
  "claude-opus-4-1": { input: 15, output: 75 },
  "claude-opus-4": { input: 15, output: 75 },
  // Claude 4 Sonnet
  "claude-sonnet-4-8": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-sonnet-4": { input: 3, output: 15 },
  // Claude 3.7 Sonnet
  "claude-3-7-sonnet": { input: 3, output: 15 },
  "claude-3-7-sonnet-latest": { input: 3, output: 15 },
  // Claude 3.5 Sonnet / Haiku
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-3-5-sonnet-latest": { input: 3, output: 15 },
  "claude-3-5-haiku": { input: 0.8, output: 4 },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4 },
};

const CONSERVATIVE_FALLBACK = { input: 15, output: 75 };

/**
 * Calculate the cost of an AI call in microdollars (integer).
 * Called once on AI response; the result is stored on the message and copied
 * to PostVersion on acceptance. Never recalculated later.
 */
export function calculateCostMicrodollars(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = PRICE_TABLE_MICRODOLLARS_PER_TOKEN[model] ?? CONSERVATIVE_FALLBACK;
  const cost =
    promptTokens * price.input + completionTokens * price.output;
  return Math.round(cost);
}
