"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import type { PostStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireDashboardAccess } from "@/lib/server-access";
import { getPlatformConfig } from "@/lib/platform-config";
import { checkActionRateLimit, formatRetryTime, serializableTransaction } from "@/lib/rate-limiter";
import { callAnthropic, calculateCostMicrodollars } from "@/lib/anthropic-client";
import { getRelevantMemories } from "@/lib/memory/memory-service";
import { summarizeMemoriesForPrompt } from "@/lib/memory/memory-summarizer";
import { buildUserProfileXml } from "@/lib/prompt-builder";
import { isContextSurveyExpired } from "@/lib/freshness";
import {
  REFINEMENT_SYSTEM_PROMPT,
  buildRefinementUserPrompt,
  parseRefinementResponse,
  quickActionInstruction,
  MAX_TURNS_BEFORE_SUMMARY,
  MAX_TURNS_PER_SESSION,
  TurnIdSchema,
  UserInstructionSchema,
  parseStoredSnapshot,
  type PostFields,
  type ConversationTurn,
  type RefinementSnapshot,
} from "@/lib/refinement-prompt";
import { assertPostMatchesCurrentVersion, PostIntegrityError } from "@/lib/post-integrity";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import {
  ForbiddenError,
  ValidationError,
  StaleSessionError,
  BlockedStatusError,
} from "./errors";
import type {
  SessionStartResult,
  SessionMessage,
  SendResult,
  PostHistoryVersion,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const POST_FIELDS_SELECT = {
  format: true,
  title: true,
  hook: true,
  body: true,
  cta: true,
  caption: true,
  musicSuggestion: true,
  duration: true,
  directions: true,
} as const;

function versionToFields(
  v: Pick<PostFields, "title" | "hook" | "body" | "cta" | "caption" | "musicSuggestion" | "duration" | "directions"> & { format?: string | null },
  fallbackFormat: string
): PostFields {
  return {
    title: v.title,
    hook: v.hook,
    body: v.body,
    cta: v.cta,
    caption: v.caption,
    format: v.format ?? fallbackFormat,
    musicSuggestion: v.musicSuggestion,
    duration: v.duration,
    directions: v.directions,
  };
}

function isRefinableStatus(status: PostStatus): boolean {
  return status !== "SCHEDULED" && status !== "PUBLISHED";
}

async function loadPostForUser(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { currentVersion: { select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true } } },
  });
  if (!post || post.userId !== userId) {
    throw new ForbiddenError("Post not found or not owned by user");
  }
  return post;
}

function snapshotToFields(snapshot: RefinementSnapshot): PostFields {
  return {
    title: snapshot.title,
    hook: snapshot.hook,
    body: snapshot.body,
    cta: snapshot.cta,
    caption: snapshot.caption,
    format: snapshot.format,
    musicSuggestion: snapshot.musicSuggestion ?? null,
    duration: snapshot.duration ?? null,
    directions: snapshot.directions ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// startRefinementSession — resume or create; transactional stale rollover
// ─────────────────────────────────────────────────────────────────────────────

export async function startRefinementSession(postId: string): Promise<SessionStartResult> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  const post = await loadPostForUser(postId, userId);
  if (!isRefinableStatus(post.status)) {
    throw new BlockedStatusError(`Refinement is blocked while post status is ${post.status}`);
  }
  if (!post.currentVersion) {
    throw new PostIntegrityError(post.id, post.currentVersionId, "MISSING_CURRENT_VERSION");
  }

  return serializableTransaction(async (tx) => {
    // Re-read the post inside the transaction so baseVersionId reflects the
    // current state at the transaction's snapshot (post may have changed
    // between the read above and the serializable transaction start).
    const freshPost = await tx.post.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        currentVersionId: true,
        status: true,
        format: true,
        currentVersion: { select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true } },
      },
    });
    if (!freshPost || freshPost.userId !== userId) {
      throw new ForbiddenError("Post not found or not owned by user");
    }
    if (!isRefinableStatus(freshPost.status)) {
      throw new BlockedStatusError(`Refinement is blocked while post status is ${freshPost.status}`);
    }
    if (!freshPost.currentVersion) {
      throw new PostIntegrityError(postId, freshPost.currentVersionId, "MISSING_CURRENT_VERSION");
    }
    const currentVersion = freshPost.currentVersion;
    const currentVersionId = freshPost.currentVersionId!;

    const existingOpen = await tx.postRefinementSession.findFirst({
      where: { postId, status: "OPEN" },
      orderBy: { startedAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 50 },
        baseVersion: { select: { ...POST_FIELDS_SELECT, id: true, versionNumber: true } },
      },
    });

    // Non-stale resume.
    if (existingOpen && existingOpen.baseVersionId === currentVersionId) {
      const baseFields = existingOpen.baseVersion
        ? versionToFields(existingOpen.baseVersion, freshPost.format)
        : versionToFields(currentVersion, freshPost.format);
      const lastAssistant = [...existingOpen.messages]
        .reverse()
        .find((m) => m.role === "ASSISTANT" && m.snapshotJson);
      let workingDraftFields = baseFields;
      if (lastAssistant?.snapshotJson) {
        const parsed = parseStoredSnapshot(lastAssistant.snapshotJson, freshPost.format);
        if (parsed) {
          workingDraftFields = snapshotToFields(parsed);
        }
      }

      return {
        sessionId: existingOpen.id,
        resumed: true,
        baseVersion: { ...baseFields, versionNumber: existingOpen.baseVersionNumber },
        workingDraft: { ...workingDraftFields, versionNumber: existingOpen.baseVersionNumber },
        messages: existingOpen.messages.map((m) => toSessionMessage(m, freshPost.format)),
      };
    }

    // Stale rollover: abandon the old session, create a new one.
    if (existingOpen) {
      await tx.postRefinementSession.update({
        where: { id: existingOpen.id },
        data: { status: "ABANDONED", completedAt: new Date() },
      });
    }

    try {
      const session = await tx.postRefinementSession.create({
        data: {
          postId,
          userId,
          status: "OPEN",
          baseVersionId: currentVersionId,
          baseVersionNumber: currentVersion.versionNumber,
        },
      });

      return {
        sessionId: session.id,
        resumed: false,
        baseVersion: { ...versionToFields(currentVersion, freshPost.format), versionNumber: currentVersion.versionNumber },
        workingDraft: { ...versionToFields(currentVersion, freshPost.format), versionNumber: currentVersion.versionNumber },
        messages: [],
        staleNotice: existingOpen
          ? "Your previous refinement session was closed because the post changed. Started a fresh session."
          : undefined,
      };
    } catch (error) {
      // Partial-index race: another request won the one-OPEN-per-post race.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const survivor = await tx.postRefinementSession.findFirst({
          where: { postId, status: "OPEN" },
          orderBy: { startedAt: "desc" },
          include: {
            messages: { orderBy: { createdAt: "asc" }, take: 50 },
            baseVersion: { select: { ...POST_FIELDS_SELECT, id: true, versionNumber: true } },
          },
        });
        if (survivor) {
          // If the survivor is itself stale, abandon it and recurse the create
          // (rare: the winning request used a now-outdated baseVersionId).
          if (survivor.baseVersionId !== currentVersionId) {
            await tx.postRefinementSession.update({
              where: { id: survivor.id },
              data: { status: "ABANDONED", completedAt: new Date() },
            });
            const fresh = await tx.postRefinementSession.create({
              data: {
                postId,
                userId,
                status: "OPEN",
                baseVersionId: currentVersionId,
                baseVersionNumber: currentVersion.versionNumber,
              },
            });
            return {
              sessionId: fresh.id,
              resumed: false,
              baseVersion: { ...versionToFields(currentVersion, freshPost.format), versionNumber: currentVersion.versionNumber },
              workingDraft: { ...versionToFields(currentVersion, freshPost.format), versionNumber: currentVersion.versionNumber },
              messages: [],
              staleNotice: "Your previous refinement session was closed because the post changed. Started a fresh session.",
            };
          }
          const baseFields = survivor.baseVersion
            ? versionToFields(survivor.baseVersion, freshPost.format)
            : versionToFields(currentVersion, freshPost.format);
          return {
            sessionId: survivor.id,
            resumed: true,
            baseVersion: { ...baseFields, versionNumber: survivor.baseVersionNumber },
            workingDraft: { ...baseFields, versionNumber: survivor.baseVersionNumber },
            messages: survivor.messages.map((m) => toSessionMessage(m, freshPost.format)),
          };
        }
      }
      throw error;
    }
  });
}

function toSessionMessage(
  m: {
    id: string; role: "USER" | "ASSISTANT" | "SYSTEM"; message: string;
    snapshotJson: unknown; createdAt: Date;
  },
  fallbackFormat: string
): SessionMessage {
  let snapshot: PostFields | null = null;
  if (m.role === "ASSISTANT" && m.snapshotJson) {
    const parsed = parseStoredSnapshot(m.snapshotJson, fallbackFormat);
    snapshot = parsed ? snapshotToFields(parsed) : null;
  }
  return {
    id: m.id,
    role: m.role,
    message: m.message,
    snapshot,
    changeSummary: m.role === "ASSISTANT" ? m.message : null,
    createdAt: m.createdAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// sendRefinementMessage — turn state machine + conversational AI call
// ─────────────────────────────────────────────────────────────────────────────

export async function sendRefinementMessage(
  sessionId: string,
  input: { inputType?: "QUICK_ACTION" | "FREEFORM" | "SUGGESTION" | "CONVERSATION"; actionKey?: string; message: string; turnId: string }
): Promise<SendResult> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  // Validate turnId as UUID (correction #6).
  const turnIdResult = TurnIdSchema.safeParse(input.turnId);
  if (!turnIdResult.success) {
    throw new ValidationError("turnId must be a valid UUID");
  }
  const turnId = turnIdResult.data;

  // Validate user instruction.
  const instructionText = input.actionKey
    ? quickActionInstruction(input.actionKey) ?? input.message
    : input.message;
  const instructionResult = UserInstructionSchema.safeParse(instructionText);
  if (!instructionResult.success) {
    throw new ValidationError("Instruction must be 1–1000 characters");
  }
  const instruction = instructionResult.data;

  // Load session + post; validate ownership + relation.
  const session = await prisma.postRefinementSession.findUnique({
    where: { id: sessionId },
    include: { post: { include: { currentVersion: { select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true } } } } },
  });
  if (!session || session.userId !== userId) {
    throw new ForbiddenError("Session not found or not owned by user");
  }
  if (session.postId !== session.post.id) {
    throw new ForbiddenError("Session/post relation mismatch");
  }
  if (session.status !== "OPEN") {
    throw new ValidationError(`Session is ${session.status}, not OPEN`);
  }
  if (!isRefinableStatus(session.post.status)) {
    throw new BlockedStatusError(`Refinement is blocked while post status is ${session.post.status}`);
  }

  // Optimistic concurrency: session base must match the post's current version.
  if (session.baseVersionId !== session.post.currentVersionId) {
    throw new StaleSessionError("This post changed after this refinement session began. Start a new session.");
  }

  // ── Turn state machine (idempotency check FIRST) ────────────────────────
  // Check for an existing turn BEFORE rate limits and turn cap. This ensures
  // transport retries of completed turns return the cached result without
  // consuming rate limits or hitting the turn cap. Previously rate limits
  // and the turn cap ran before this check, so a retry of a completed 10th
  // turn was rejected by the cap before the cached result could be returned.
  const existingTurn = await prisma.postRefinementTurn.findUnique({
    where: { sessionId_turnId: { sessionId, turnId } },
  });

  if (existingTurn) {
    if (existingTurn.status === "COMPLETE") {
      const assistant = await prisma.postRefinementMessage.findFirst({
        where: { sessionId, turnId, role: "ASSISTANT" },
        orderBy: { createdAt: "desc" },
      });
      if (assistant?.snapshotJson) {
        const snapshot = parseStoredSnapshot(assistant.snapshotJson, session.post.format);
        if (snapshot) {
          return {
            status: "COMPLETE",
            assistantMessageId: assistant.id,
            preview: snapshotToFields(snapshot),
            changeSummary: assistant.message,
            attemptCount: existingTurn.attemptCount,
          };
        }
        // Stored snapshot is corrupt — mark the turn ERROR so it's retryable
        // instead of returning IN_PROGRESS forever.
        await failTurn(sessionId, turnId, "SCHEMA_INVALID", "Stored assistant snapshot failed validation", existingTurn.attemptCount);
        return {
          status: "ERROR",
          errorKind: "SCHEMA_INVALID",
          error: "Stored assistant snapshot failed validation",
          retryable: true,
          attemptCount: existingTurn.attemptCount,
        };
      }
      // COMPLETE turn with no ASSISTANT message — also corrupt; mark ERROR.
      await failTurn(sessionId, turnId, "SCHEMA_INVALID", "Complete turn has no assistant message", existingTurn.attemptCount);
      return {
        status: "ERROR",
        errorKind: "SCHEMA_INVALID",
        error: "Complete turn has no assistant message",
        retryable: true,
        attemptCount: existingTurn.attemptCount,
      };
    }
    if (existingTurn.status === "PROCESSING") {
      return { status: "IN_PROGRESS", attemptCount: existingTurn.attemptCount };
    }
    if (existingTurn.status === "ERROR") {
      // Atomically claim a retry. Rate limits still apply to retries.
      const burst = await checkActionRateLimit(`refine_burst:${userId}`, 4, 2 * 60 * 1000);
      if (!burst.allowed) {
        throw new ValidationError(`Too many refinement requests. Try again in ${formatRetryTime(burst.retryAfterMs ?? 0)}.`);
      }
      const hourly = await checkActionRateLimit(`refine_hour:${userId}`, 15, 60 * 60 * 1000);
      if (!hourly.allowed) {
        throw new ValidationError(`Hourly refinement limit reached. Try again in ${formatRetryTime(hourly.retryAfterMs ?? 0)}.`);
      }
      const claimed = await prisma.postRefinementTurn.updateMany({
        where: { id: existingTurn.id, status: "ERROR" },
        data: { status: "PROCESSING", attemptCount: { increment: 1 }, processingAt: new Date(), updatedAt: new Date() },
      });
      if (claimed.count === 0) {
        // Another request already claimed it.
        return { status: "IN_PROGRESS", attemptCount: existingTurn.attemptCount };
      }
      // Proceed with retry using the claimed turn.
      return runRefinementTurn(session, instruction, turnId, input, existingTurn.attemptCount + 1, false);
    }
    // PENDING — treat as in-progress (shouldn't normally happen).
    return { status: "IN_PROGRESS", attemptCount: existingTurn.attemptCount };
  }

  // No existing turn — this is a new turn. Apply rate limits and turn cap
  // only for new turns (retries of ERROR turns are handled above).
  const burst = await checkActionRateLimit(`refine_burst:${userId}`, 4, 2 * 60 * 1000);
  if (!burst.allowed) {
    throw new ValidationError(`Too many refinement requests. Try again in ${formatRetryTime(burst.retryAfterMs ?? 0)}.`);
  }
  const hourly = await checkActionRateLimit(`refine_hour:${userId}`, 15, 60 * 60 * 1000);
  if (!hourly.allowed) {
    throw new ValidationError(`Hourly refinement limit reached. Try again in ${formatRetryTime(hourly.retryAfterMs ?? 0)}.`);
  }

  // Per-session turn cap: prevent endless refinement loops / AI usage farming.
  const userTurnCount = await prisma.postRefinementMessage.count({
    where: { sessionId, role: "USER" },
  });
  if (userTurnCount >= MAX_TURNS_PER_SESSION) {
    throw new ValidationError(
      `Refinement session limit reached (${MAX_TURNS_PER_SESSION} turns). Accept or discard to start fresh.`
    );
  }

  // No existing turn — create one in PROCESSING and run.
  return runRefinementTurn(session, instruction, turnId, input, 1, true);
}

async function runRefinementTurn(
  session: {
    id: string; postId: string; userId: string; baseVersionId: string | null; baseVersionNumber: number;
    post: {
      id: string; userId: string; status: PostStatus; currentVersionId: string | null; format: string;
      currentVersion: { id: string; postId: string; versionNumber: number } & Omit<PostFields, "format"> | null;
    };
  },
  instruction: string,
  turnId: string,
  input: { inputType?: "QUICK_ACTION" | "FREEFORM" | "SUGGESTION" | "CONVERSATION"; actionKey?: string; message: string },
  attemptCount: number,
  isNewTurn: boolean
): Promise<SendResult> {
  const { post } = session;

  // Save USER message only on the initial claim, not on retries.
  if (isNewTurn) {
    try {
      // Wrap turn + message creation in a transaction so a crash between
      // them doesn't leave a stuck PROCESSING turn with no USER message.
      // Previously these were two separate awaits — a crash after turn
      // creation but before message creation left an unrecoverable turn.
      await prisma.$transaction([
        prisma.postRefinementTurn.create({
          data: { sessionId: session.id, turnId, status: "PROCESSING", attemptCount, processingAt: new Date() },
        }),
        prisma.postRefinementMessage.create({
          data: {
            sessionId: session.id,
            turnId,
            role: "USER",
            inputType: input.inputType ?? "FREEFORM",
            actionKey: input.actionKey ?? null,
            // Store the resolved instruction (what the AI actually received) so
            // quick-actions show readable text in the conversation history
            // instead of an empty bubble when the user clicked a chip without typing.
            message: instruction,
            instructionLength: instruction.length,
          },
        }),
      ]);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        // Concurrent duplicate — another request created the turn first.
        return { status: "IN_PROGRESS", attemptCount };
      }
      throw error;
    }
  }

  // Build conversational prompt. Fetch the most recent USER+ASSISTANT
  // messages (desc + take), then reverse to chronological order for display.
  const recentMessages = await prisma.postRefinementMessage.findMany({
    where: { sessionId: session.id, role: { in: ["USER", "ASSISTANT"] } },
    orderBy: { createdAt: "desc" },
    take: MAX_TURNS_BEFORE_SUMMARY + 2,
  });
  recentMessages.reverse();

  const allTurns: ConversationTurn[] = recentMessages
    .filter((m) => !(m.turnId === turnId && m.role === "USER")) // exclude the just-saved current instruction
    .map((m) => {
      if (m.role === "USER") {
        return { role: "USER" as const, message: m.message };
      }
      let snapshot: PostFields | null = null;
      if (m.snapshotJson) {
        const parsed = parseStoredSnapshot(m.snapshotJson, post.format);
        if (parsed) {
          snapshot = snapshotToFields(parsed);
        }
      }
      return { role: "ASSISTANT" as const, message: m.message, snapshot };
    });

  // Most recent 2 turns verbatim; older ones summarized.
  const recentTurns = allTurns.slice(-2);
  const olderTurns = allTurns.slice(0, Math.max(0, allTurns.length - 2));

  if (!post.currentVersion) {
    throw new PostIntegrityError(post.id, post.currentVersionId, "MISSING_CURRENT_VERSION");
  }
  const original = versionToFields(post.currentVersion, post.format);
  const lastAssistant = [...allTurns].reverse().find((t) => t.role === "ASSISTANT" && t.snapshot);
  const workingDraft = lastAssistant?.snapshot ?? original;

  // Brand-voice context.
  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  const answers = (questionnaire?.content ?? {}) as unknown as QuestionnaireFormData;
  // Load profile surveys so compliance guardrails, offer restrictions, proof
  // bank, and deep-dive context are included in refinement prompts. Previously
  // this was hardcoded to [], which bypassed all compliance rules during
  // refinement — allowing AI to generate non-compliant content.
  // Expired context surveys (WEEKLY_CONTEXT, MONTHLY_CONTEXT, STORY_REFRESH)
  // are filtered out so stale data doesn't influence refinement.
  const allProfileSurveys = await prisma.profileSurvey.findMany({
    where: { userId: session.userId },
    select: { surveyType: true, answersJson: true, updatedAt: true },
  });
  const profileSurveys = allProfileSurveys.filter(
    (s) => !isContextSurveyExpired(s.surveyType, s.updatedAt)
  );
  const userProfileXml = buildUserProfileXml({ answers, profileSurveys });
  const memories = await getRelevantMemories(session.userId);
  const memoriesXml = summarizeMemoriesForPrompt(memories);

  const userPrompt = buildRefinementUserPrompt({
    original,
    workingDraft,
    recentTurns,
    olderTurns,
    instruction,
    userProfileXml,
    memoriesXml,
  });

  const config = await getPlatformConfig();
  const apiKey = config.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? null;
  if (!apiKey) {
    await failTurn(session.id, turnId, "PROVIDER_ERROR", "AI service not configured", attemptCount);
    return { status: "ERROR", errorKind: "PROVIDER_ERROR", error: "AI service not configured", retryable: false, attemptCount };
  }
  const model = config.anthropicModel || "claude-opus-4-8";

  const result = await callAnthropic({
    apiKey,
    model,
    system: REFINEMENT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 2000,
  });

  if (!result.ok) {
    await failTurn(session.id, turnId, result.errorKind, result.errorMessage, attemptCount);
    return {
      status: "ERROR",
      errorKind: result.errorKind,
      error: result.errorMessage,
      retryable: result.errorKind !== "PROVIDER_ERROR" || (result.status ?? 0) >= 500,
      attemptCount,
    };
  }

  const parsed = parseRefinementResponse(result.text, post.format);
  if (!parsed.ok || !parsed.data) {
    await failTurn(session.id, turnId, parsed.errorKind ?? "PARSE_ERROR", parsed.errorMessage ?? "Parse failed", attemptCount);
    return {
      status: "ERROR",
      errorKind: parsed.errorKind ?? "PARSE_ERROR",
      error: parsed.errorMessage ?? "Parse failed",
      retryable: true,
      attemptCount,
    };
  }

  const snapshot = parsed.data.snapshot;
  const costMicrodollars = calculateCostMicrodollars(model, result.promptTokens, result.completionTokens);

  // Success: mark turn COMPLETE, save ASSISTANT message. Capture the created
  // message id so the client can accept it by id.
  const created = await prisma.$transaction(async (tx) => {
    await tx.postRefinementTurn.update({
      where: { sessionId_turnId: { sessionId: session.id, turnId } },
      data: { status: "COMPLETE", completedAt: new Date(), lastErrorKind: null, lastErrorMessage: null, updatedAt: new Date() },
    });
    const msg = await tx.postRefinementMessage.create({
      data: {
        sessionId: session.id,
        turnId,
        role: "ASSISTANT",
        inputType: "CONVERSATION",
        message: snapshot.changeSummary,
        snapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        latencyMs: result.latencyMs,
        estimatedCostMicrodollars: costMicrodollars,
      },
    });
    await tx.postRefinementSession.update({
      where: { id: session.id },
      data: { lastActivityAt: new Date() },
    });
    return msg;
  });

  return {
    status: "COMPLETE",
    assistantMessageId: created.id,
    preview: snapshotToFields(snapshot),
    changeSummary: snapshot.changeSummary,
    attemptCount,
  };
}

async function failTurn(
  sessionId: string,
  turnId: string,
  errorKind: string,
  errorMessage: string,
  attemptCount: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.postRefinementTurn.update({
      where: { sessionId_turnId: { sessionId, turnId } },
      data: { status: "ERROR", lastErrorKind: errorKind, lastErrorMessage: errorMessage, updatedAt: new Date() },
    });
    // Multiple SYSTEM audit messages allowed across retries (no unique constraint).
    await tx.postRefinementMessage.create({
      data: {
        sessionId,
        turnId,
        role: "SYSTEM",
        message: `[${errorKind}] ${errorMessage} (attempt ${attemptCount})`,
      },
    });
    await tx.postRefinementSession.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// acceptRefinement — accept a specifically selected assistant message
// ─────────────────────────────────────────────────────────────────────────────

export async function acceptRefinement(
  sessionId: string,
  assistantMessageId: string
): Promise<{ success: boolean; postId: string; versionNumber: number }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  return serializableTransaction(async (tx) => {
    const session = await tx.postRefinementSession.findUnique({
      where: { id: sessionId },
      include: {
        post: {
          include: {
            currentVersion: { select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true } },
            calendar: { select: { id: true, contentJson: true } },
          },
        },
      },
    });

    // Ownership + relation validation (correction #6).
    if (!session || session.userId !== userId) {
      throw new ForbiddenError("Session not found or not owned by user");
    }
    if (session.postId !== session.post.id) {
      throw new ForbiddenError("Session/post relation mismatch");
    }
    if (session.status !== "OPEN") {
      throw new ValidationError(`Session is ${session.status}, not OPEN`);
    }
    if (!isRefinableStatus(session.post.status)) {
      throw new BlockedStatusError(`Refinement is blocked while post status is ${session.post.status}`);
    }

    // Data-integrity guard (correction #7).
    assertPostMatchesCurrentVersion(session.post, session.post.currentVersion);

    // Optimistic concurrency.
    if (session.baseVersionId !== session.post.currentVersionId) {
      throw new StaleSessionError("This post changed after this refinement session began.");
    }

    // Load + verify the selected assistant message.
    const assistantMessage = await tx.postRefinementMessage.findUnique({
      where: { id: assistantMessageId },
    });
    if (!assistantMessage || assistantMessage.sessionId !== sessionId) {
      throw new ForbiddenError("Assistant message not found in this session");
    }
    if (assistantMessage.role !== "ASSISTANT") {
      throw new ValidationError("Selected message is not an assistant message");
    }
    if (assistantMessage.acceptedAt) {
      throw new ValidationError("This assistant message has already been accepted");
    }
    if (!assistantMessage.snapshotJson) {
      throw new ValidationError("Selected assistant message has no preview snapshot");
    }

    // Re-validate the snapshot with Zod (tolerates legacy snapshots missing
    // format by backfilling from the post's current format).
    const snapshot = parseStoredSnapshot(assistantMessage.snapshotJson, session.post.format);
    if (!snapshot) {
      throw new ValidationError("Selected snapshot failed validation");
    }

    const baseVersionNumber = session.baseVersionNumber;

    // Create the new PostVersion. Cost + aiModel + latencyMs + changeSummary
    // are copied verbatim from the assistant message (corrections #4, #8).
    const newVersion = await tx.postVersion.create({
      data: {
        postId: session.postId,
        versionNumber: baseVersionNumber + 1,
        source: "AI_REFINEMENT",
        format: snapshot.format,
        title: snapshot.title,
        hook: snapshot.hook,
        body: snapshot.body,
        cta: snapshot.cta,
        caption: snapshot.caption,
        musicSuggestion: snapshot.musicSuggestion ?? null,
        duration: snapshot.duration ?? null,
        directions: snapshot.directions ?? null,
        changeSummary: assistantMessage.message, // copied from message
        aiModel: assistantMessage.model,
        estimatedCostMicrodollars: assistantMessage.estimatedCostMicrodollars,
        latencyMs: assistantMessage.latencyMs,
        previousVersionId: session.baseVersionId,
      },
    });

    // Update Post: currentVersionId + denormalized fields + status = REFINED.
    await tx.post.update({
      where: { id: session.postId },
      data: {
        currentVersionId: newVersion.id,
        title: snapshot.title,
        hook: snapshot.hook,
        body: snapshot.body,
        cta: snapshot.cta,
        caption: snapshot.caption,
        format: snapshot.format,
        musicSuggestion: snapshot.musicSuggestion ?? null,
        duration: snapshot.duration ?? null,
        directions: snapshot.directions ?? null,
        status: "REFINED",
      },
    });

    // Mark the assistant message as accepted.
    await tx.postRefinementMessage.update({
      where: { id: assistantMessageId },
      data: { acceptedAt: new Date() },
    });

    // Close the session.
    await tx.postRefinementSession.update({
      where: { id: sessionId },
      data: {
        status: "ACCEPTED",
        acceptedVersionId: newVersion.id,
        completedAt: new Date(),
        lastActivityAt: new Date(),
      },
    });

    // Sync contentJson: reconstruct days from all current Post rows, preserve
    // the rest of contentJson (correction #4 + #10).
    await syncCalendarContentJson(tx, session.post.calendarId);

    revalidatePath("/dashboard/calendar");

    return { success: true, postId: session.postId, versionNumber: newVersion.versionNumber };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// rejectRefinement / discardRefinementSession
// ─────────────────────────────────────────────────────────────────────────────

export async function rejectRefinement(sessionId: string): Promise<{ success: boolean }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  const session = await prisma.postRefinementSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new ForbiddenError("Session not found or not owned by user");
  }
  if (session.status !== "OPEN") {
    throw new ValidationError(`Session is ${session.status}, not OPEN`);
  }

  await prisma.postRefinementSession.update({
    where: { id: sessionId },
    data: { status: "REJECTED", completedAt: new Date(), lastActivityAt: new Date() },
  });

  return { success: true };
}

export async function discardRefinementSession(sessionId: string): Promise<{ success: boolean }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  const session = await prisma.postRefinementSession.findUnique({ where: { id: sessionId } });
  if (!session || session.userId !== userId) {
    throw new ForbiddenError("Session not found or not owned by user");
  }
  if (session.status !== "OPEN") {
    // Already closed — idempotent.
    return { success: true };
  }

  await prisma.postRefinementSession.update({
    where: { id: sessionId },
    data: { status: "ABANDONED", completedAt: new Date() },
  });

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// getPostHistory / restoreVersion
// ─────────────────────────────────────────────────────────────────────────────

export async function getPostHistory(postId: string): Promise<PostHistoryVersion[]> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true, format: true } });
  if (!post || post.userId !== userId) {
    throw new ForbiddenError("Post not found or not owned by user");
  }

  const versions = await prisma.postVersion.findMany({
    where: { postId },
    orderBy: { versionNumber: "desc" },
    select: { ...POST_FIELDS_SELECT, id: true, versionNumber: true, source: true, changeSummary: true, createdAt: true },
  });

  return versions.map((v) => ({
    id: v.id,
    versionNumber: v.versionNumber,
    source: v.source,
    changeSummary: v.changeSummary,
    createdAt: v.createdAt.toISOString(),
    fields: versionToFields(v, post.format),
  }));
}

export async function restoreVersion(
  postId: string,
  versionId: string
): Promise<{ success: boolean; versionNumber: number }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) throw new ForbiddenError(access.error);
  const userId = access.user.id;

  return serializableTransaction(async (tx) => {
    const post = await tx.post.findUnique({
      where: { id: postId },
      include: {
        currentVersion: { select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true } },
        calendar: { select: { id: true } },
      },
    });
    if (!post || post.userId !== userId) {
      throw new ForbiddenError("Post not found or not owned by user");
    }
    if (!isRefinableStatus(post.status)) {
      throw new BlockedStatusError(`Restore is blocked while post status is ${post.status}`);
    }

    // Data-integrity guard (correction #7).
    assertPostMatchesCurrentVersion(post, post.currentVersion);

    const targetVersion = await tx.postVersion.findUnique({
      where: { id: versionId },
      select: { ...POST_FIELDS_SELECT, id: true, postId: true, versionNumber: true },
    });
    if (!targetVersion || targetVersion.postId !== postId) {
      throw new ForbiddenError("Version not found or does not belong to this post");
    }

    const maxVersion = await tx.postVersion.findFirst({
      where: { postId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });
    const nextVersionNumber = (maxVersion?.versionNumber ?? 0) + 1;

    const newVersion = await tx.postVersion.create({
      data: {
        postId,
        versionNumber: nextVersionNumber,
        source: "RESTORE",
        format: targetVersion.format ?? post.format,
        title: targetVersion.title,
        hook: targetVersion.hook,
        body: targetVersion.body,
        cta: targetVersion.cta,
        caption: targetVersion.caption,
        musicSuggestion: targetVersion.musicSuggestion,
        duration: targetVersion.duration,
        directions: targetVersion.directions,
        changeSummary: `Restored from version ${targetVersion.versionNumber}`,
        restoredFromVersionId: versionId,
        previousVersionId: post.currentVersionId,
      },
    });

    await tx.post.update({
      where: { id: postId },
      data: {
        currentVersionId: newVersion.id,
        title: targetVersion.title,
        hook: targetVersion.hook,
        body: targetVersion.body,
        cta: targetVersion.cta,
        caption: targetVersion.caption,
        format: targetVersion.format ?? post.format,
        musicSuggestion: targetVersion.musicSuggestion,
        duration: targetVersion.duration,
        directions: targetVersion.directions,
        status: "REFINED",
      },
    });

    await syncCalendarContentJson(tx, post.calendarId);

    revalidatePath("/dashboard/calendar");

    return { success: true, versionNumber: newVersion.versionNumber };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// contentJson sync — reconstruct days from all current Post rows (correction #4)
// ─────────────────────────────────────────────────────────────────────────────

async function syncCalendarContentJson(
  tx: Prisma.TransactionClient,
  calendarId: string
): Promise<void> {
  const calendar = await tx.calendar.findUnique({
    where: { id: calendarId },
    select: { contentJson: true },
  });
  if (!calendar) return;

  const posts = await tx.post.findMany({
    where: { calendarId },
    orderBy: { dayIndex: "asc" },
    select: {
      day: true, format: true, bucket: true, title: true, hook: true,
      body: true, cta: true, caption: true, musicSuggestion: true,
      duration: true, directions: true, dayIndex: true,
    },
  });

  const days = posts.map((p) => ({
    day: p.day,
    format: p.format,
    bucket: p.bucket,
    title: p.title,
    hook: p.hook,
    body: p.body,
    cta: p.cta,
    caption: p.caption,
    musicSuggestion: p.musicSuggestion ?? undefined,
    duration: p.duration ?? undefined,
    directions: p.directions ?? undefined,
  }));

  const existing = (calendar.contentJson ?? {}) as Record<string, unknown>;
  await tx.calendar.update({
    where: { id: calendarId },
    data: {
      contentJson: { ...existing, days } as unknown as Prisma.InputJsonValue,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// abandonStaleSessions — cron cleanup
// ─────────────────────────────────────────────────────────────────────────────

const STALE_SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const STUCK_TURN_MS = 10 * 60 * 1000; // 10 minutes

export async function abandonStaleSessions(): Promise<{
  abandonedSessions: number;
  stuckTurns: number;
}> {
  const staleBefore = new Date(Date.now() - STALE_SESSION_MS);
  const stuckBefore = new Date(Date.now() - STUCK_TURN_MS);

  const [abandonedSessions, stuckTurns] = await Promise.all([
    prisma.postRefinementSession.updateMany({
      where: { status: "OPEN", lastActivityAt: { lt: staleBefore } },
      data: { status: "ABANDONED", completedAt: new Date() },
    }),
    prisma.postRefinementTurn.updateMany({
      where: { status: "PROCESSING", processingAt: { lt: stuckBefore } },
      data: { status: "ERROR", lastErrorKind: "STUCK_PROCESSING", lastErrorMessage: "Turn stuck in PROCESSING", updatedAt: new Date() },
    }),
  ]);

  return { abandonedSessions: abandonedSessions.count, stuckTurns: stuckTurns.count };
}
