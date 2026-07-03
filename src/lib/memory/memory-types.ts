import type { MemoryType, Importance, MemorySource } from "@prisma/client";

export { MemoryType, Importance, MemorySource };

export type MemoryTypeValue = `${MemoryType}`;
export type ImportanceValue = `${Importance}`;
export type MemorySourceValue = `${MemorySource}`;

export interface CreatorMemoryData {
  id: string;
  userId: string;
  memoryType: MemoryType;
  title: string;
  summary: string;
  evidence: string | null;
  confidence: number;
  importance: Importance;
  source: MemorySource;
  metadata: Record<string, unknown> | null;
  embedding: string | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

export interface SaveMemoryInput {
  userId: string;
  memoryType: MemoryType;
  title: string;
  summary: string;
  evidence?: string;
  confidence?: number;
  importance?: Importance;
  source?: MemorySource;
  metadata?: Record<string, unknown>;
  pinned?: boolean;
}

export interface MemoryMatchCriteria {
  userId: string;
  memoryType: MemoryType;
  title?: string;
  titleSimilarityThreshold?: number;
}

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  IDENTITY: "Identity",
  VOICE: "Voice",
  AUDIENCE: "Audience",
  CONTENT: "Content",
  PERFORMANCE: "Performance",
  STRATEGY: "Strategy",
  PREFERENCE: "Preferences",
  WARNING: "Warnings",
};

export const MEMORY_TYPE_DESCRIPTIONS: Record<MemoryType, string> = {
  IDENTITY: "Who the creator is — business, industry, positioning, personal story",
  VOICE: "Tone, language patterns, signature phrases, humor style",
  AUDIENCE: "Who follows them — demographics, interests, pain points",
  CONTENT: "What works — formats, topics, structures that resonate",
  PERFORMANCE: "Data-driven insights — what outperforms, timing, engagement patterns",
  STRATEGY: "Goals, CTAs, offers, seasonal rhythms, content strategy",
  PREFERENCE: "Posting cadence, on-camera comfort, format preferences, boundaries",
  WARNING: "What to avoid — banned words, rejected topics, anti-patterns",
};

export const IMPORTANCE_LABELS: Record<Importance, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const IMPORTANCE_ORDER: Importance[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export const SOURCE_LABELS: Record<MemorySource, string> = {
  QUESTIONNAIRE: "Questionnaire",
  PROFILE_SURVEY: "Profile Survey",
  ANALYTICS: "Analytics",
  CONTENT_FEEDBACK: "Content Feedback",
  AI_GENERATED: "AI Generated",
  ADMIN: "Admin",
  SYSTEM: "System",
};

export const IMPORTANCE_FOR_PROMPT: Importance[] = ["HIGH", "CRITICAL"];

export const DEFAULT_CONFIDENCE = 50;
export const MIN_CONFIDENCE = 0;
export const MAX_CONFIDENCE = 100;
export const CONFIDENCE_INCREMENT_ON_MERGE = 10;
export const CONFIDENCE_INCREMENT_ON_TOUCH = 2;
export const STALE_MEMORY_DAYS = 90;
