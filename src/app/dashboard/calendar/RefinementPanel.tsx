"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import {
  startRefinementSession,
  sendRefinementMessage,
  acceptRefinement,
  rejectRefinement,
  discardRefinementSession,
  getPostHistory,
  restoreVersion,
} from "@/app/dashboard/post-refinement/actions";
import type {
  SessionStartResult,
  SessionMessage,
  SendResult,
  PostHistoryVersion,
} from "@/app/dashboard/post-refinement/types";
import {
  QUICK_ACTIONS,
  type PostFields,
} from "@/lib/refinement-prompt";
import {
  X,
  Loader2,
  Send,
  Check,
  RotateCcw,
  Trash2,
  History,
  Sparkles,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

interface RefinementPanelProps {
  postId: string;
  postTitle: string;
  /** Current day index — preserved on close so the calendar returns to the same day. */
  onClose: () => void;
  /** Called after a successful accept/restore so the parent can refresh. */
  onPostChanged: () => void;
}

type ViewState = "loading" | "ready" | "error";

interface TurnState {
  turnId: string;
  status: "idle" | "sending" | "complete" | "in_progress" | "error";
  preview: PostFields | null;
  changeSummary: string | null;
  assistantMessageId: string | null;
  errorKind: string | null;
  error: string | null;
  attemptCount: number;
}

function newTurnId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const MAX_INSTRUCTION = 1000;

export function RefinementPanel({ postId, postTitle, onClose, onPostChanged }: RefinementPanelProps) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [session, setSession] = useState<SessionStartResult | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [instruction, setInstruction] = useState("");
  const [turn, setTurn] = useState<TurnState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<PostHistoryVersion[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [topError, setTopError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll, capture + restore focus, trap Tab, Esc to close.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog.
    const t = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 0);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const focusables = dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);

    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey, true);
      window.clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  // Start (or resume) the session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await startRefinementSession(postId);
        if (cancelled) return;
        setSession(result);
        setMessages(result.messages);
        if (result.staleNotice) setStaleNotice(result.staleNotice);
        setViewState("ready");
      } catch (err) {
        if (cancelled) return;
        setTopError(err instanceof Error ? err.message : "Failed to start refinement session");
        setViewState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const handleSend = useCallback(
    async (actionKey?: string) => {
      if (!session || isPending) return;
      const text = actionKey ? instruction : instruction.trim();
      if (!text && !actionKey) return;
      if (text.length > MAX_INSTRUCTION) return;

      const turnId = newTurnId();
      setTurn({
        turnId,
        status: "sending",
        preview: null,
        changeSummary: null,
        assistantMessageId: null,
        errorKind: null,
        error: null,
        attemptCount: 0,
      });
      setInstruction("");

      startTransition(async () => {
        try {
          const result: SendResult = await sendRefinementMessage(session.sessionId, {
            inputType: actionKey ? "QUICK_ACTION" : "FREEFORM",
            actionKey,
            message: text,
            turnId,
          });

          if (result.status === "COMPLETE") {
            setTurn({
              turnId,
              status: "complete",
              preview: result.preview,
              changeSummary: result.changeSummary,
              assistantMessageId: result.assistantMessageId || null,
              errorKind: null,
              error: null,
              attemptCount: result.attemptCount,
            });
            // Reload messages + session to include the new USER + ASSISTANT
            // pair. Updating session (not just messages) handles the edge case
            // where the post changed mid-flight and a new session was created.
            const refreshed = await startRefinementSession(postId);
            setSession(refreshed);
            setMessages(refreshed.messages);
          } else if (result.status === "IN_PROGRESS") {
            setTurn({
              turnId,
              status: "in_progress",
              preview: null,
              changeSummary: null,
              assistantMessageId: null,
              errorKind: null,
              error: null,
              attemptCount: result.attemptCount,
            });
          } else {
            setTurn({
              turnId,
              status: "error",
              preview: null,
              changeSummary: null,
              assistantMessageId: null,
              errorKind: result.errorKind,
              error: result.error,
              attemptCount: result.attemptCount,
            });
          }
        } catch (err) {
          setTurn({
            turnId,
            status: "error",
            preview: null,
            changeSummary: null,
            assistantMessageId: null,
            errorKind: "EXCEPTION",
            error: err instanceof Error ? err.message : "Unexpected error",
            attemptCount: 0,
          });
        }
      });
    },
    [session, isPending, instruction, postId]
  );

  const handleRetry = useCallback(() => {
    if (!turn || turn.status !== "error" || !session) return;
    // Retry with the SAME turnId — claims the ERROR turn and re-runs.
    const turnId = turn.turnId;
    setTurn({ ...turn, status: "sending", error: null, errorKind: null });
    startTransition(async () => {
      try {
        // Re-send the original instruction. The turn state machine detects
        // the ERROR turn and claims a retry. Use reverse().find instead of
        // findLast (ES2023) for ES2017 target compatibility.
        const lastUser = [...messages].reverse().find((m) => m.role === "USER");
        const result = await sendRefinementMessage(session.sessionId, {
          inputType: "FREEFORM",
          message: lastUser?.message ?? "",
          turnId,
        });
        if (result.status === "COMPLETE") {
          setTurn({
            turnId,
            status: "complete",
            preview: result.preview,
            changeSummary: result.changeSummary,
            assistantMessageId: result.assistantMessageId || null,
            errorKind: null,
            error: null,
            attemptCount: result.attemptCount,
          });
          const refreshed = await startRefinementSession(postId);
          setSession(refreshed);
          setMessages(refreshed.messages);
        } else if (result.status === "IN_PROGRESS") {
          setTurn({ ...turn, status: "in_progress", attemptCount: result.attemptCount });
        } else {
          setTurn({
            turnId,
            status: "error",
            preview: null,
            changeSummary: null,
            assistantMessageId: null,
            errorKind: result.errorKind,
            error: result.error,
            attemptCount: result.attemptCount,
          });
        }
      } catch (err) {
        setTurn({
          turnId,
          status: "error",
          preview: null,
          changeSummary: null,
          assistantMessageId: null,
          errorKind: "EXCEPTION",
          error: err instanceof Error ? err.message : "Retry failed",
          attemptCount: turn.attemptCount,
        });
      }
    });
  }, [turn, session, messages, postId]);

  const handleAccept = useCallback(() => {
    if (!turn || turn.status !== "complete" || !turn.assistantMessageId || !session) return;
    startTransition(async () => {
      try {
        await acceptRefinement(session.sessionId, turn.assistantMessageId!);
        onPostChanged();
        onClose();
      } catch (err) {
        setTopError(err instanceof Error ? err.message : "Failed to accept refinement");
      }
    });
  }, [turn, session, onPostChanged, onClose]);

  const handleReject = useCallback(() => {
    if (!session) return;
    startTransition(async () => {
      try {
        await rejectRefinement(session.sessionId);
        setTurn(null);
      } catch (err) {
        setTopError(err instanceof Error ? err.message : "Failed to reject");
      }
    });
  }, [session]);

  const handleDiscard = useCallback(() => {
    if (!session) return;
    startTransition(async () => {
      try {
        await discardRefinementSession(session.sessionId);
        onClose();
      } catch (err) {
        setTopError(err instanceof Error ? err.message : "Failed to discard session");
      }
    });
  }, [session, onClose]);

  const handleShowHistory = useCallback(async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history.length === 0) {
      setHistoryLoading(true);
      try {
        const h = await getPostHistory(postId);
        setHistory(h);
      } catch (err) {
        setTopError(err instanceof Error ? err.message : "Failed to load history");
      } finally {
        setHistoryLoading(false);
      }
    }
  }, [historyOpen, history.length, postId]);

  const handleRestore = useCallback(
    (versionId: string, versionNumber: number) => {
      startTransition(async () => {
        try {
          await restoreVersion(postId, versionId);
          setHistoryOpen(false);
          onPostChanged();
          onClose();
        } catch (err) {
          setTopError(err instanceof Error ? err.message : `Failed to restore version ${versionNumber}`);
        }
      });
    },
    [postId, onPostChanged, onClose]
  );

  return (
    <>
      {/* Backdrop — transparent on phone (sheet covers full screen), dimmed on tablet+ */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm sm:block hidden"
        onClick={onClose}
        aria-hidden
      />

      {/* Phone: full-screen sheet. Tablet/desktop: right-side slide-over. */}
      <div
        ref={dialogRef}
        className="fixed inset-0 z-50 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-full sm:max-w-lg bg-background-card sm:border-l border-border-primary flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`Refine post: ${postTitle}`}
      >
        {/* Header — safe-area top padding clears the iPhone notch/status bar. */}
        <div
          className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-border-primary shrink-0"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-5 w-5 text-accent-primary shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-serif)" }}>
                Tweak this post
              </h2>
              <p className="text-xs text-text-muted truncate">{postTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mr-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {staleNotice && (
          <div className="px-4 sm:px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300">
            {staleNotice}
          </div>
        )}

        {topError && (
          <div className="px-4 sm:px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{topError}</span>
          </div>
        )}

        {/* Body — scrollable. Safe-area bottom padding so content clears the home indicator when no footer is rendered. */}
        <div
          className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          {viewState === "loading" && (
            <div className="flex items-center justify-center py-12 text-text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {viewState === "error" && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-text-muted">Could not open refinement.</p>
            </div>
          )}

          {viewState === "ready" && (
            <>
              {/* Conversation history */}
              {messages.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-text-muted uppercase">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Conversation
                  </div>
                  {messages.map((m) => (
                    <ConversationBubble key={m.id} message={m} />
                  ))}
                </div>
              )}

              {/* Current preview */}
              {turn?.status === "complete" && turn.preview && (
                <PreviewCard
                  preview={turn.preview}
                  changeSummary={turn.changeSummary}
                  onAccept={handleAccept}
                  onReject={handleReject}
                  disabled={isPending}
                />
              )}

              {/* In-progress */}
              {turn?.status === "in_progress" && (
                <div className="flex items-center gap-2 text-sm text-text-muted bg-background-secondary/40 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Working on a previous request...
                </div>
              )}

              {/* Error */}
              {turn?.status === "error" && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 space-y-2">
                  <div className="flex items-start gap-2 text-sm text-red-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{turn.errorKind}</p>
                      <p className="text-xs text-red-300/80">{turn.error}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRetry}
                    disabled={isPending}
                    className="text-xs font-semibold text-red-200 hover:text-white border border-red-500/40 hover:border-red-500/60 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
                  >
                    Try again
                  </button>
                </div>
              )}

              {/* Version history */}
              {historyOpen && (
                <div className="rounded-lg border border-border-primary bg-background-secondary/30 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-text-muted uppercase">
                    <History className="h-3.5 w-3.5" />
                    Version history
                  </div>
                  {historyLoading ? (
                    <div className="flex items-center gap-2 text-sm text-text-muted py-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-60 overflow-y-auto">
                      {history.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-md hover:bg-background-card/60"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-text-primary">v{v.versionNumber}</span>
                            <span className="text-xs text-text-muted ml-2">{v.source}</span>
                            {v.changeSummary && (
                              <p className="text-xs text-text-muted truncate">{v.changeSummary}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRestore(v.id, v.versionNumber)}
                            disabled={isPending}
                            className="text-xs text-accent-primary hover:text-accent-primary/80 flex items-center gap-1 shrink-0 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" /> Restore
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — input + actions. Safe-area bottom padding clears the home indicator. */}
        {viewState === "ready" && (
          <div
            className="shrink-0 border-t border-border-primary px-4 sm:px-6 py-3 space-y-3 bg-background-card"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {/* Quick actions */}
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => handleSend(a.key)}
                  disabled={isPending || turn?.status === "sending"}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-border-primary text-text-secondary hover:text-text-primary hover:border-accent-primary/30 hover:bg-background-secondary/60 transition-colors disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Instruction input */}
            <div className="flex items-end gap-2">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value.slice(0, MAX_INSTRUCTION))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Tell the AI how to change this post… (e.g. &quot;Redirect the CTA to my buying-and-selling chart/guide&quot;)"
                rows={2}
                className="flex-1 resize-none rounded-lg border border-border-primary bg-background-secondary/40 px-3 py-2 text-base sm:text-sm text-text-primary placeholder:text-text-muted/70 focus:outline-none focus:border-accent-primary/50"
                disabled={isPending || turn?.status === "sending"}
              />
              <button
                onClick={() => handleSend()}
                disabled={isPending || turn?.status === "sending" || !instruction.trim()}
                aria-label="Send instruction"
                className="p-2.5 rounded-lg bg-accent-primary text-white hover:bg-accent-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {turn?.status === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-text-muted">
                {instruction.length}/{MAX_INSTRUCTION}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleShowHistory}
                  className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 px-2 py-1 rounded-md hover:bg-background-secondary/60 transition-colors"
                >
                  <History className="h-3.5 w-3.5" /> History
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={isPending}
                  className="text-xs text-text-muted hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-background-secondary/60 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConversationBubble({ message }: { message: SessionMessage }) {
  if (message.role === "SYSTEM") {
    return (
      <div className="text-xs text-text-muted bg-background-secondary/40 rounded-md p-2 border border-border-primary/40">
        <span className="font-semibold">System:</span> {message.message}
      </div>
    );
  }
  if (message.role === "USER") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg rounded-br-sm bg-accent-primary/15 border border-accent-primary/20 px-3 py-2 text-sm text-text-primary">
          {message.message}
        </div>
      </div>
    );
  }
  // ASSISTANT — render changeSummary as plain text (no HTML injection).
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg rounded-bl-sm bg-background-secondary/60 border border-border-primary px-3 py-2 text-sm text-text-primary">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-primary mb-1">
          <Sparkles className="h-3 w-3" /> AI revision
        </div>
        <p className="whitespace-pre-wrap text-text-secondary">{message.changeSummary ?? message.message}</p>
      </div>
    </div>
  );
}

function PreviewCard({
  preview,
  changeSummary,
  onAccept,
  onReject,
  disabled,
}: {
  preview: PostFields;
  changeSummary: string | null;
  onAccept: () => void;
  onReject: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-lg border-2 border-accent-primary/30 bg-accent-primary/5 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-accent-primary uppercase">
        <Check className="h-3.5 w-3.5" /> Preview
      </div>

      <div className="space-y-2 text-sm">
        <PreviewField label="Hook" value={preview.hook} />
        {preview.format !== "Static" && <PreviewField label="CTA" value={preview.cta} />}
        <PreviewField label={preview.format === "Static" ? "Image Text" : "Body"} value={preview.body} multiline />
        <PreviewField label="Caption" value={preview.caption} multiline />
      </div>

      {changeSummary && (
        <div className="text-xs text-text-secondary bg-background-card/60 rounded-md p-2 border border-border-primary/40">
          <p className="font-semibold text-text-primary mb-1">What changed:</p>
          <p className="whitespace-pre-wrap">{changeSummary}</p>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onAccept}
          disabled={disabled}
          className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold bg-accent-primary text-white hover:bg-accent-primary/90 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Accept
        </button>
        <button
          onClick={onReject}
          disabled={disabled}
          className="text-sm font-semibold text-text-muted hover:text-text-primary border border-border-primary hover:bg-background-secondary/60 rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function PreviewField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <span className="text-xs font-bold tracking-wider text-text-muted uppercase">{label}</span>
      <p className={`text-text-primary ${multiline ? "whitespace-pre-wrap" : ""}`}>{value}</p>
    </div>
  );
}
