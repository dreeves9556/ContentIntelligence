"use client";

import { useState, useEffect, useRef, useCallback, useTransition, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  CalendarGenerationContext,
  type CalendarGenerationContextValue,
  type GenerationPhase,
} from "./CalendarGenerationContext";
import { GeneratingOverlay } from "./GeneratingOverlay";
import { generateWeeklyCalendar, checkGenerationRequest } from "./actions";
import { getTimezoneOffsetHours } from "@/lib/best-time";

const statusSteps = [
  { label: "Analyzing your questionnaire...", progress: 8 },
  { label: "Reviewing your brand voice and surveys...", progress: 18 },
  { label: "Checking your recent content for freshness...", progress: 30 },
  { label: "Building your content strategy...", progress: 42 },
  { label: "Generating your content calendar...", progress: 55 },
  { label: "Writing captions and hooks...", progress: 68 },
  { label: "Polishing post directions and CTAs...", progress: 78 },
  { label: "Finalizing your calendar...", progress: 85 },
];

const REFRESH_TIMEOUT_MS = 12_000;
const READY_HOLD_MS = 300;
const OVERLAY_EXIT_MS = 400;
const CHECK_POLL_MS = 2_000;
const CHECK_MAX_MS = 30_000;

interface CalendarGenerationShellProps {
  currentCalendarId: string | null;
  defaultDaysToPost: number;
  children: ReactNode;
}

export function CalendarGenerationShell({
  currentCalendarId,
  defaultDaysToPost,
  children,
}: CalendarGenerationShellProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [phase, setPhase] = useState<GenerationPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [lastDaysToPost, setLastDaysToPost] = useState(defaultDaysToPost);
  const [isRegenerate, setIsRegenerate] = useState(false);

  const generationRequestId = useRef<string | null>(null);
  const expectedCalendarId = useRef<string | null>(null);
  const claimLogId = useRef<string | null>(null);
  const claimToken = useRef<string | null>(null);

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkDeadlineRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyOverflowRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const isBusy = phase !== "idle";

  // ── Cleanup helpers ──────────────────────────────────────────
  const clearAllTimeouts = useCallback(() => {
    if (refreshTimeoutRef.current) { clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; }
    if (exitTimeoutRef.current) { clearTimeout(exitTimeoutRef.current); exitTimeoutRef.current = null; }
    if (statusIntervalRef.current) { clearInterval(statusIntervalRef.current); statusIntervalRef.current = null; }
    if (checkPollRef.current) { clearInterval(checkPollRef.current); checkPollRef.current = null; }
    if (checkDeadlineRef.current) { clearTimeout(checkDeadlineRef.current); checkDeadlineRef.current = null; }
  }, []);

  const resetToIdle = useCallback(() => {
    clearAllTimeouts();
    setPhase("idle");
    setError(null);
    setStatusLabel("");
    setProgress(0);
    generationRequestId.current = null;
    expectedCalendarId.current = null;
    claimLogId.current = null;
    claimToken.current = null;
    // Restore body scroll
    if (typeof document !== "undefined") {
      document.body.style.overflow = bodyOverflowRef.current ?? "";
    }
  }, [clearAllTimeouts]);

  // ── Body scroll lock + cleanup on unmount ─────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAllTimeouts();
      if (typeof document !== "undefined") {
        document.body.style.overflow = bodyOverflowRef.current ?? "";
      }
    };
  }, [clearAllTimeouts]);

  useEffect(() => {
    if (isBusy && typeof document !== "undefined") {
      bodyOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    } else if (!isBusy && typeof document !== "undefined") {
      document.body.style.overflow = bodyOverflowRef.current ?? "";
    }
  }, [isBusy]);

  // ── Status rotation while generating ──────────────────────────
  useEffect(() => {
    if (phase !== "generating") return;
    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep = Math.min(currentStep + 1, statusSteps.length - 1);
      setProgress(statusSteps[currentStep].progress);
      setStatusLabel(statusSteps[currentStep].label);
    }, 8000);
    statusIntervalRef.current = interval;
    return () => { clearInterval(interval); statusIntervalRef.current = null; };
  }, [phase]);

  // ── Watch for currentCalendarId === expectedCalendarId ────────
  useEffect(() => {
    if (phase !== "refreshing") return;
    if (!expectedCalendarId.current) return;
    if (currentCalendarId === expectedCalendarId.current) {
      // New calendar arrived — start the exit sequence.
      if (refreshTimeoutRef.current) { clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; }
      setStatusLabel("Your new calendar is ready.");
      setProgress(100);
      setPhase("ready");
      exitTimeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setPhase("exiting");
        exitTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          resetToIdle();
          // Focus the new calendar heading.
          requestAnimationFrame(() => {
            const heading = document.querySelector("[data-calendar-heading]");
            if (heading instanceof HTMLElement) {
              heading.focus();
            }
          });
        }, OVERLAY_EXIT_MS);
      }, READY_HOLD_MS);
    }
  }, [currentCalendarId, phase, resetToIdle]);

  // ── Focus the new calendar heading after CalendarClient remount ─
  // (handled in the exit sequence above)

  // ── Unknown-outcome polling ───────────────────────────────────
  const startChecking = useCallback(() => {
    setPhase("checking");
    setStatusLabel("Checking your generation...");
    const requestId = generationRequestId.current;
    if (!requestId) return;

    const poll = async () => {
      if (!mountedRef.current) return;
      try {
        const result = await checkGenerationRequest(requestId);
        if (!mountedRef.current) return;
        if (result.status === "COMPLETED") {
          clearAllTimeouts();
          expectedCalendarId.current = result.calendarId;
          setStatusLabel("Loading your new calendar...");
          setPhase("refreshing");
          startTransition(() => router.refresh());
          refreshTimeoutRef.current = setTimeout(() => {
            if (!mountedRef.current) return;
            setError("Your new calendar was generated, but it didn't load.");
            setPhase("refresh_error");
          }, REFRESH_TIMEOUT_MS);
        } else if (result.status === "FAILED") {
          clearAllTimeouts();
          setError(result.errorMessage || "Generation failed.");
          setPhase("generation_error");
        } else if (result.status === "NOT_FOUND") {
          clearAllTimeouts();
          setError("Generation could not be confirmed.");
          setPhase("generation_error");
        }
        // PROCESSING — keep polling
      } catch {
        // Network error during check — keep polling until deadline.
      }
    };
    void poll();
    checkPollRef.current = setInterval(poll, CHECK_POLL_MS);
    checkDeadlineRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      clearAllTimeouts();
      setError("Your calendar may still be generating. You can wait or load the current calendar.");
      setPhase("unknown_outcome");
    }, CHECK_MAX_MS);
  }, [clearAllTimeouts, router, startTransition]);

  // ── Core generation function ──────────────────────────────────
  const runGeneration = useCallback(async (
    requestId: string,
    daysToPost: number,
    regen: boolean,
  ) => {
    setPhase("generating");
    setError(null);
    setProgress(statusSteps[0].progress);
    setStatusLabel(statusSteps[0].label);
    setIsRegenerate(regen);

    try {
      const result = await generateWeeklyCalendar(
        getTimezoneOffsetHours(),
        daysToPost,
        requestId,
      );

      if (!mountedRef.current) return;

      if (result.success) {
        // Generation succeeded — wait for the new calendar to arrive via router.refresh().
        expectedCalendarId.current = result.calendarId;
        setStatusLabel("Loading your new calendar...");
        setPhase("refreshing");
        startTransition(() => router.refresh());
        refreshTimeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          setError("Your new calendar was generated, but it didn't load.");
          setPhase("refresh_error");
        }, REFRESH_TIMEOUT_MS);
        // Clear localStorage (existing logic from GenerateButton).
        try {
          const keys = Object.keys(localStorage);
          for (const key of keys) {
            if (key.startsWith("calendar-posted-") || key.startsWith("calendar-feedback-")) {
              localStorage.removeItem(key);
            }
          }
        } catch {
          // ignore localStorage errors
        }
      } else if (result.inProgress) {
        // Another generation with the same requestId is already running — check its status.
        startChecking();
      } else {
        // Confirmed failure.
        setError(result.error);
        setPhase("generation_error");
      }
    } catch {
      if (!mountedRef.current) return;
      // Transport/abort error — don't assume failure. Check by requestId.
      startChecking();
    }
  }, [router, startTransition, startChecking]);

  // ── Public API: startNewGeneration ────────────────────────────
  const startNewGeneration = useCallback((daysToPost?: number) => {
    if (phase !== "idle") return; // double-click / second-trigger guard
    const effectiveDays = daysToPost ?? defaultDaysToPost;
    const requestId = crypto.randomUUID();
    generationRequestId.current = requestId;
    setLastDaysToPost(effectiveDays);
    void runGeneration(requestId, effectiveDays, currentCalendarId !== null);
  }, [phase, defaultDaysToPost, currentCalendarId, runGeneration]);

  // ── Public API: retryGeneration ───────────────────────────────
  const retryGeneration = useCallback(() => {
    const requestId = generationRequestId.current;
    if (!requestId) return; // nothing to retry
    clearAllTimeouts();
    setError(null);
    setProgress(0);
    setStatusLabel("");
    void runGeneration(requestId, lastDaysToPost, currentCalendarId !== null);
  }, [clearAllTimeouts, lastDaysToPost, currentCalendarId, runGeneration]);

  // ── Overlay action handlers ───────────────────────────────────
  const handleReturnToCalendar = useCallback(() => {
    resetToIdle();
  }, [resetToIdle]);

  const handleLoadNewCalendar = useCallback(() => {
    // Refresh-only: do NOT regenerate.
    clearAllTimeouts();
    setStatusLabel("Loading your new calendar...");
    setPhase("refreshing");
    startTransition(() => router.refresh());
    refreshTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setError("Your new calendar was generated, but it didn't load.");
      setPhase("refresh_error");
    }, REFRESH_TIMEOUT_MS);
  }, [clearAllTimeouts, router, startTransition]);

  const handleKeepWaiting = useCallback(() => {
    startChecking();
  }, [startChecking]);

  // ── Context value ─────────────────────────────────────────────
  const contextValue: CalendarGenerationContextValue = {
    startNewGeneration,
    retryGeneration,
    phase,
    error,
    lastDaysToPost,
    isBusy,
  };

  // ── Render ────────────────────────────────────────────────────
  const showOverlay = phase !== "idle";

  return (
    <CalendarGenerationContext.Provider value={contextValue}>
      <div inert={showOverlay || undefined} aria-busy={showOverlay || undefined}>
        {children}
      </div>
      {showOverlay && typeof document !== "undefined" && createPortal(
        <GeneratingOverlay
          phase={phase}
          statusLabel={statusLabel}
          progress={progress}
          daysToPost={lastDaysToPost}
          isRegenerate={isRegenerate}
          error={error}
          onRetry={retryGeneration}
          onReturnToCalendar={handleReturnToCalendar}
          onLoadNewCalendar={handleLoadNewCalendar}
          onKeepWaiting={handleKeepWaiting}
        />,
        document.body,
      )}
    </CalendarGenerationContext.Provider>
  );
}
