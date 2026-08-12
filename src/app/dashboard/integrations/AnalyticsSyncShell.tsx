"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { syncAnalytics } from "./actions";
import type { AIInsightResult } from "../actions";
import { AnalyticsSyncOverlay } from "./AnalyticsSyncOverlay";

const statusSteps = [
  { label: "Connecting to your social accounts...", progress: 8 },
  { label: "Fetching recent post performance...", progress: 28 },
  { label: "Refreshing audience and follower data...", progress: 48 },
  { label: "Updating deep analytics...", progress: 68 },
  { label: "Preparing your latest performance insight...", progress: 84 },
];

const STATUS_INTERVAL_MS = 8_000;
const SUCCESS_OVERLAY_MS = 900;
const FEEDBACK_RESET_MS = 4_000;

export type AnalyticsSyncStatus = "idle" | "loading" | "success" | "error";

interface AnalyticsSyncContextValue {
  status: AnalyticsSyncStatus;
  message: string;
  startSync: () => void;
  retrySync: () => void;
}

interface AnalyticsSyncShellProps {
  children: ReactNode;
  onInsightRefresh?: (result: AIInsightResult) => void;
}

const AnalyticsSyncContext = createContext<AnalyticsSyncContextValue | null>(null);

export function useAnalyticsSync() {
  const context = useContext(AnalyticsSyncContext);
  if (!context) {
    throw new Error("useAnalyticsSync must be used within an AnalyticsSyncShell");
  }
  return context;
}

export function AnalyticsSyncShell({ children, onInsightRefresh }: AnalyticsSyncShellProps) {
  const [status, setStatus] = useState<AnalyticsSyncStatus>("idle");
  const [message, setMessage] = useState("");
  const [statusLabel, setStatusLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [overlayOpen, setOverlayOpen] = useState(false);

  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }
    if (overlayCloseTimeoutRef.current) {
      clearTimeout(overlayCloseTimeoutRef.current);
      overlayCloseTimeoutRef.current = null;
    }
    if (feedbackResetTimeoutRef.current) {
      clearTimeout(feedbackResetTimeoutRef.current);
      feedbackResetTimeoutRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    clearTimers();
    busyRef.current = false;
    setStatus("idle");
    setMessage("");
    setStatusLabel("");
    setProgress(0);
    setOverlayOpen(false);
  }, [clearTimers]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    if (!overlayOpen || typeof document === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [overlayOpen]);

  useEffect(() => {
    if (status !== "loading") return;

    let currentStep = 0;
    const interval = setInterval(() => {
      currentStep = Math.min(currentStep + 1, statusSteps.length - 1);
      setProgress(statusSteps[currentStep].progress);
      setStatusLabel(statusSteps[currentStep].label);
    }, STATUS_INTERVAL_MS);
    statusIntervalRef.current = interval;

    return () => {
      clearInterval(interval);
      statusIntervalRef.current = null;
    };
  }, [status]);

  const completeWithSuccess = useCallback((result: { synced: number; insightResult?: AIInsightResult }) => {
    if (!mountedRef.current) return;
    busyRef.current = false;
    if (result.insightResult) onInsightRefresh?.(result.insightResult);
    setStatus("success");
    setMessage(`Synced ${result.synced} post${result.synced === 1 ? "" : "s"}`);
    setStatusLabel("Your analytics are up to date.");
    setProgress(100);

    overlayCloseTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) setOverlayOpen(false);
    }, SUCCESS_OVERLAY_MS);
    feedbackResetTimeoutRef.current = setTimeout(resetToIdle, FEEDBACK_RESET_MS);
  }, [onInsightRefresh, resetToIdle]);

  const completeWithError = useCallback((errorMessage: string) => {
    if (!mountedRef.current) return;
    busyRef.current = false;
    setStatus("error");
    setMessage(errorMessage);
    setStatusLabel("Analytics update could not be completed.");
    setProgress(0);
    setOverlayOpen(true);
  }, []);

  const runSync = useCallback(async () => {
    if (busyRef.current) return;

    clearTimers();
    busyRef.current = true;
    setStatus("loading");
    setMessage("");
    setStatusLabel(statusSteps[0].label);
    setProgress(statusSteps[0].progress);
    setOverlayOpen(true);

    try {
      const result = await syncAnalytics();
      if (!mountedRef.current) return;

      if (result.success && typeof result.synced === "number") {
        completeWithSuccess(result);
      } else {
        completeWithError(result.message ?? "No connected accounts to sync");
      }
    } catch {
      completeWithError("Sync failed — check your connection");
    }
  }, [clearTimers, completeWithError, completeWithSuccess]);

  const startSync = useCallback(() => {
    void runSync();
  }, [runSync]);

  const retrySync = useCallback(() => {
    if (status !== "error") return;
    void runSync();
  }, [runSync, status]);

  const contextValue: AnalyticsSyncContextValue = {
    status,
    message,
    startSync,
    retrySync,
  };

  const showOverlay = overlayOpen && status !== "idle";

  return (
    <AnalyticsSyncContext.Provider value={contextValue}>
      <div inert={showOverlay || undefined} aria-busy={showOverlay || undefined}>
        {children}
      </div>
      {showOverlay && typeof document !== "undefined" && createPortal(
        <AnalyticsSyncOverlay
          status={status}
          statusLabel={statusLabel}
          progress={progress}
          message={message}
          onRetry={retrySync}
          onDismiss={resetToIdle}
        />,
        document.body,
      )}
    </AnalyticsSyncContext.Provider>
  );
}
