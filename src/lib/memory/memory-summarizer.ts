import type { MemoryType } from "@prisma/client";
import type { CreatorMemoryData } from "./memory-types";
import { MEMORY_TYPE_LABELS } from "./memory-types";

const XML_TAG_BY_TYPE: Record<MemoryType, string> = {
  IDENTITY: "identity",
  VOICE: "voice",
  AUDIENCE: "audience",
  CONTENT: "content",
  PERFORMANCE: "performance",
  STRATEGY: "strategy",
  PREFERENCE: "preferences",
  WARNING: "warnings",
};

const SECTION_ORDER: MemoryType[] = [
  "IDENTITY",
  "AUDIENCE",
  "VOICE",
  "PERFORMANCE",
  "CONTENT",
  "STRATEGY",
  "PREFERENCE",
  "WARNING",
];

export function summarizeMemoriesForPrompt(
  memories: CreatorMemoryData[]
): string {
  if (memories.length === 0) return "";

  const grouped = new Map<MemoryType, CreatorMemoryData[]>();
  for (const memory of memories) {
    const list = grouped.get(memory.memoryType) ?? [];
    list.push(memory);
    grouped.set(memory.memoryType, list);
  }

  const sections: string[] = [];
  for (const type of SECTION_ORDER) {
    const typeMemories = grouped.get(type);
    if (!typeMemories || typeMemories.length === 0) continue;

    const tag = XML_TAG_BY_TYPE[type];
    const lines = typeMemories.map((m) => {
      const confidenceTag = m.confidence >= 80 ? " (high confidence)" : "";
      const pinnedTag = m.pinned ? " [PINNED]" : "";
      return `- ${m.summary}${confidenceTag}${pinnedTag}`;
    });
    sections.push(`<${tag}>\n${lines.join("\n")}\n</${tag}>`);
  }

  if (sections.length === 0) return "";

  return `<creator_memory>
This is the AI's accumulated long-term memory about this creator, built up over time from their questionnaire, surveys, analytics, and feedback patterns. These are strategic insights that should shape every content decision. Treat them as authoritative context that overrides generic assumptions:

${sections.join("\n\n")}
</creator_memory>`;
}

export function summarizeMemoriesForDisplay(
  memories: CreatorMemoryData[]
): Record<MemoryType, CreatorMemoryData[]> {
  const grouped = {} as Record<MemoryType, CreatorMemoryData[]>;
  for (const type of SECTION_ORDER) {
    grouped[type] = memories.filter((m) => m.memoryType === type);
  }
  return grouped;
}

export { SECTION_ORDER as MEMORY_SECTION_ORDER, XML_TAG_BY_TYPE as MEMORY_XML_TAGS, MEMORY_TYPE_LABELS };
