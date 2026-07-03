import { prisma } from "@/lib/prisma";
import type { MemoryType, Importance, MemorySource } from "@prisma/client";
import type {
  CreatorMemoryData,
  SaveMemoryInput,
} from "./memory-types";
import {
  DEFAULT_CONFIDENCE,
  MIN_CONFIDENCE,
  MAX_CONFIDENCE,
  CONFIDENCE_INCREMENT_ON_MERGE,
  CONFIDENCE_INCREMENT_ON_TOUCH,
  IMPORTANCE_FOR_PROMPT,
} from "./memory-types";

// ─── Helpers ───────────────────────────────────────────────────────

function clampConfidence(n: number): number {
  return Math.max(MIN_CONFIDENCE, Math.min(MAX_CONFIDENCE, Math.round(n)));
}

function toData(m: {
  id: string;
  userId: string;
  memoryType: MemoryType;
  title: string;
  summary: string;
  evidence: string | null;
  confidence: number;
  importance: Importance;
  source: MemorySource;
  metadata: unknown;
  embedding: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}): CreatorMemoryData {
  return {
    ...m,
    metadata: (m.metadata as Record<string, unknown> | null) ?? null,
  };
}

function normalizeTitle(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const wordsA = new Set(na.split(" "));
  const wordsB = new Set(nb.split(" "));
  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  const union = wordsA.size + wordsB.size - common;
  return union > 0 ? common / union : 0;
}

// ─── Public API ────────────────────────────────────────────────────

export async function getUserMemories(
  userId: string,
  memoryType?: MemoryType
): Promise<CreatorMemoryData[]> {
  const rows = await prisma.creatorMemory.findMany({
    where: { userId, ...(memoryType ? { memoryType } : {}) },
    orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toData);
}

export async function getRelevantMemories(
  userId: string
): Promise<CreatorMemoryData[]> {
  const rows = await prisma.creatorMemory.findMany({
    where: {
      userId,
      OR: [
        { importance: { in: IMPORTANCE_FOR_PROMPT } },
        { pinned: true },
      ],
    },
    orderBy: [{ pinned: "desc" }, { importance: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toData);
}

export async function saveMemory(
  input: SaveMemoryInput
): Promise<CreatorMemoryData> {
  const confidence = clampConfidence(input.confidence ?? DEFAULT_CONFIDENCE);

  const existing = await findSimilarMemory(
    input.userId,
    input.memoryType,
    input.title
  );

  if (existing) {
    return mergeMemory(existing.id, {
      summary: input.summary,
      evidence: input.evidence,
      confidenceDelta: CONFIDENCE_INCREMENT_ON_MERGE,
      importance: input.importance,
      source: input.source,
      metadata: input.metadata,
    });
  }

  const row = await prisma.creatorMemory.create({
    data: {
      userId: input.userId,
      memoryType: input.memoryType,
      title: input.title,
      summary: input.summary,
      evidence: input.evidence ?? null,
      confidence,
      importance: input.importance ?? "MEDIUM",
      source: input.source ?? "SYSTEM",
      metadata: (input.metadata ?? null) as unknown as never,
      pinned: input.pinned ?? false,
    },
  });
  return toData(row);
}

export async function updateMemory(
  id: string,
  patch: {
    title?: string;
    summary?: string;
    evidence?: string | null;
    confidence?: number;
    importance?: Importance;
    source?: MemorySource;
    metadata?: Record<string, unknown> | null;
    pinned?: boolean;
  }
): Promise<CreatorMemoryData | null> {
  const row = await prisma.creatorMemory.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.evidence !== undefined ? { evidence: patch.evidence } : {}),
      ...(patch.confidence !== undefined
        ? { confidence: clampConfidence(patch.confidence) }
        : {}),
      ...(patch.importance !== undefined ? { importance: patch.importance } : {}),
      ...(patch.source !== undefined ? { source: patch.source } : {}),
      ...(patch.metadata !== undefined
        ? { metadata: patch.metadata as unknown as never }
        : {}),
      ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
    },
  });
  return toData(row);
}

export async function mergeMemory(
  id: string,
  patch: {
    summary?: string;
    evidence?: string;
    confidenceDelta?: number;
    importance?: Importance;
    source?: MemorySource;
    metadata?: Record<string, unknown>;
  }
): Promise<CreatorMemoryData> {
  const current = await prisma.creatorMemory.findUnique({ where: { id } });
  if (!current) throw new Error(`Memory ${id} not found`);

  const newConfidence = clampConfidence(
    current.confidence + (patch.confidenceDelta ?? 0)
  );

  const newImportance = patch.importance ?? current.importance;
  const newSource = patch.source ?? current.source;

  const mergedEvidence = patch.evidence
    ? [current.evidence, patch.evidence].filter(Boolean).join("\n---\n")
    : current.evidence;

  const mergedMetadata = patch.metadata
    ? { ...((current.metadata as Record<string, unknown>) ?? {}), ...patch.metadata }
    : (current.metadata as Record<string, unknown> | null);

  const row = await prisma.creatorMemory.update({
    where: { id },
    data: {
      ...(patch.summary ? { summary: patch.summary } : {}),
      evidence: mergedEvidence,
      confidence: newConfidence,
      importance: newImportance,
      source: newSource,
      metadata: mergedMetadata as unknown as never,
      updatedAt: new Date(),
    },
  });
  return toData(row);
}

export async function deleteMemory(id: string): Promise<void> {
  await prisma.creatorMemory.delete({ where: { id } });
}

export async function touchMemory(id: string): Promise<void> {
  await prisma.creatorMemory.update({
    where: { id },
    data: {
      lastUsedAt: new Date(),
    },
  });
}

export async function touchMemories(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.creatorMemory.updateMany({
    where: { id: { in: ids } },
    data: { lastUsedAt: new Date() },
  });
}

export async function findSimilarMemory(
  userId: string,
  memoryType: MemoryType,
  title: string,
  threshold: number = 0.6
): Promise<CreatorMemoryData | null> {
  const candidates = await prisma.creatorMemory.findMany({
    where: { userId, memoryType },
    select: {
      id: true,
      userId: true,
      memoryType: true,
      title: true,
      summary: true,
      evidence: true,
      confidence: true,
      importance: true,
      source: true,
      metadata: true,
      embedding: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      lastUsedAt: true,
    },
  });

  let best: { data: CreatorMemoryData; score: number } | null = null;
  for (const row of candidates) {
    const score = titleSimilarity(title, row.title);
    if (score >= threshold && (!best || score > best.score)) {
      best = { data: toData(row), score };
    }
  }
  return best?.data ?? null;
}

// ─── Memory Consolidation ──────────────────────────────────────────

export async function mergeDuplicateMemories(
  userId: string
): Promise<{ merged: number; deleted: number }> {
  const allMemories = await prisma.creatorMemory.findMany({
    where: { userId },
    orderBy: [{ memoryType: "asc" }, { createdAt: "asc" }],
  });

  let merged = 0;
  let deleted = 0;
  const processed = new Set<string>();

  for (const memory of allMemories) {
    if (processed.has(memory.id)) continue;

    const duplicates = allMemories.filter(
      (m) =>
        m.id !== memory.id &&
        !processed.has(m.id) &&
        m.memoryType === memory.memoryType &&
        titleSimilarity(memory.title, m.title) >= 0.6
    );

    if (duplicates.length === 0) {
      processed.add(memory.id);
      continue;
    }

    const allDupes = [memory, ...duplicates];
    const bestConfidence = Math.max(...allDupes.map((d) => d.confidence));
    const bestImportance = allDupes.map((d) => d.importance).sort().reverse()[0];
    const combinedEvidence = allDupes
      .map((d) => d.evidence)
      .filter(Boolean)
      .join("\n---\n");

    await prisma.creatorMemory.update({
      where: { id: memory.id },
      data: {
        confidence: clampConfidence(bestConfidence + CONFIDENCE_INCREMENT_ON_MERGE),
        importance: bestImportance,
        evidence: combinedEvidence || null,
        updatedAt: new Date(),
      },
    });

    const dupeIds = duplicates.map((d) => d.id);
    await prisma.creatorMemory.deleteMany({
      where: { id: { in: dupeIds } },
    });

    merged += duplicates.length;
    deleted += duplicates.length;
    processed.add(memory.id);
    for (const d of duplicates) processed.add(d.id);
  }

  return { merged, deleted };
}

// ─── Admin: get all memories across users ──────────────────────────

export async function getAllMemoriesForAdmin(filters?: {
  userId?: string;
  memoryType?: MemoryType;
  importance?: Importance;
  source?: MemorySource;
  search?: string;
}): Promise<(CreatorMemoryData & { userEmail: string | null; userName: string | null })[]> {
  const where: Record<string, unknown> = {};
  if (filters?.userId) where.userId = filters.userId;
  if (filters?.memoryType) where.memoryType = filters.memoryType;
  if (filters?.importance) where.importance = filters.importance;
  if (filters?.source) where.source = filters.source;
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { summary: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.creatorMemory.findMany({
    where,
    orderBy: [{ updatedAt: "desc" }],
    take: 500,
    include: {
      user: {
        select: { email: true, name: true },
      },
    },
  });

  return rows.map((r) => ({
    ...toData(r),
    userEmail: r.user.email,
    userName: r.user.name,
  }));
}
