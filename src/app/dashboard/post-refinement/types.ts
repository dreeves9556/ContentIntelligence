/**
 * Public result types for the Post Refinement engine.
 *
 * Kept in a separate non-"use server" module so the client can import them
 * without pulling the server-action file into the client bundle.
 */

import type { PostFields } from "@/lib/refinement-prompt";

export interface SessionStartResult {
  sessionId: string;
  resumed: boolean;
  baseVersion: PostFields & { versionNumber: number };
  workingDraft: PostFields & { versionNumber: number };
  messages: SessionMessage[];
  staleNotice?: string;
}

export interface SessionMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  message: string;
  snapshot: PostFields | null;
  changeSummary: string | null;
  createdAt: string;
}

export type SendResult =
  | { status: "COMPLETE"; assistantMessageId: string; preview: PostFields; changeSummary: string; attemptCount: number }
  | { status: "IN_PROGRESS"; attemptCount: number }
  | { status: "ERROR"; errorKind: string; error: string; retryable: boolean; attemptCount: number };

export interface PostHistoryVersion {
  id: string;
  versionNumber: number;
  source: string;
  changeSummary: string | null;
  createdAt: string;
  fields: PostFields;
}
