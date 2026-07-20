export type BlockPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TrimStrategy = "preserve_start" | "preserve_end" | "preserve_edges" | "omit_if_over";

export interface PromptBlock {
  id: string;
  content: string;
  priority: BlockPriority;
  maxChars?: number;
  trimStrategy?: TrimStrategy;
}

export interface BudgetedBlockMetadata {
  id: string;
  priority: BlockPriority;
  originalChars: number;
  finalChars: number;
  trimmed: boolean;
  omitted: boolean;
  trimStrategy: TrimStrategy;
}

export interface BudgetedPromptResult {
  prompt: string;
  totalChars: number;
  included: BudgetedBlockMetadata[];
  trimmed: BudgetedBlockMetadata[];
  omitted: BudgetedBlockMetadata[];
}

const PRIORITY_ORDER: Record<BlockPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const DEFAULT_MAX_CHARS = 120_000;

function trimBlock(
  content: string,
  maxChars: number,
  strategy: TrimStrategy,
): string {
  if (content.length <= maxChars) return content;

  const ellipsis = "\n…[trimmed]";

  switch (strategy) {
    case "preserve_start":
      return content.slice(0, Math.max(0, maxChars - ellipsis.length)) + ellipsis;

    case "preserve_end":
      return ellipsis + content.slice(Math.max(0, content.length - maxChars + ellipsis.length));

    case "preserve_edges": {
      const half = Math.max(0, Math.floor((maxChars - ellipsis.length) / 2));
      return content.slice(0, half) + ellipsis + content.slice(content.length - half);
    }

    case "omit_if_over":
      return "";

    default:
      return content.slice(0, maxChars);
  }
}

export function buildBudgetedPrompt(
  blocks: PromptBlock[],
  options?: { maxChars?: number },
): BudgetedPromptResult {
  const maxChars = options?.maxChars ?? DEFAULT_MAX_CHARS;

  const sorted = [...blocks]
    .filter((b) => b.content && b.content.trim().length > 0)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  const included: BudgetedBlockMetadata[] = [];
  const trimmed: BudgetedBlockMetadata[] = [];
  const omitted: BudgetedBlockMetadata[] = [];

  let remaining = maxChars;
  const parts: string[] = [];

  for (const block of sorted) {
    const originalChars = block.content.length;
    const strategy: TrimStrategy = block.trimStrategy ?? "preserve_start";
    const blockMax = block.maxChars ?? originalChars;

    if (remaining <= 0 && block.priority !== "CRITICAL") {
      omitted.push({
        id: block.id,
        priority: block.priority,
        originalChars,
        finalChars: 0,
        trimmed: false,
        omitted: true,
        trimStrategy: strategy,
      });
      continue;
    }

    const effectiveLimit = block.priority === "CRITICAL"
      ? Math.min(blockMax, remaining > 0 ? Math.max(remaining, blockMax) : blockMax)
      : Math.min(blockMax, remaining);

    const trimmedContent = trimBlock(block.content, effectiveLimit, strategy);

    if (trimmedContent.length === 0 && strategy === "omit_if_over" && block.content.length > effectiveLimit) {
      omitted.push({
        id: block.id,
        priority: block.priority,
        originalChars,
        finalChars: 0,
        trimmed: false,
        omitted: true,
        trimStrategy: strategy,
      });
      continue;
    }

    const wasTrimmed = trimmedContent.length < originalChars;

    parts.push(trimmedContent);
    remaining -= trimmedContent.length;

    const meta: BudgetedBlockMetadata = {
      id: block.id,
      priority: block.priority,
      originalChars,
      finalChars: trimmedContent.length,
      trimmed: wasTrimmed,
      omitted: false,
      trimStrategy: strategy,
    };

    included.push(meta);
    if (wasTrimmed) trimmed.push(meta);
  }

  const prompt = parts.join("\n\n");
  return {
    prompt,
    totalChars: prompt.length,
    included,
    trimmed,
    omitted,
  };
}
