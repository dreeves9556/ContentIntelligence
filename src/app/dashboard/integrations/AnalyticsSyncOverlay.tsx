"use client";

import { useEffect, useRef } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { AnalyticsSyncStatus } from "./AnalyticsSyncShell";

interface AnalyticsSyncOverlayProps {
  status: AnalyticsSyncStatus;
  statusLabel: string;
  progress: number;
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export function AnalyticsSyncOverlay({
  status,
  statusLabel,
  progress,
  message,
  onRetry,
  onDismiss,
}: AnalyticsSyncOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headlineId = "analytics-sync-overlay-headline";
  const isError = status === "error";
  const isSuccess = status === "success";

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isError) {
      dialogRef.current?.querySelector("button")?.focus();
    }
  }, [isError]);

  const headline = isError
    ? "Analytics Update Failed"
    : isSuccess
      ? "Analytics Updated"
      : "Updating Your Analytics";

  return (
    <>
      <div
        className="fixed inset-0 z-[60] overflow-y-auto bg-background-primary"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headlineId}
          tabIndex={-1}
          className="min-h-full flex flex-col items-center justify-center px-4 py-8 animate-overlay-in"
        >
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="relative mx-auto h-36 w-full max-w-sm" aria-hidden="true">
              <svg
                viewBox="0 0 320 132"
                className={`absolute inset-0 h-full w-full ${isError ? "text-red-400" : "text-accent-primary"}`}
                fill="none"
                role="img"
              >
                <defs>
                  <linearGradient id="analytics-sync-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
                    <stop offset="48%" stopColor="currentColor" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
                  </linearGradient>
                </defs>
                <path
                  d="M12 102 C38 96 45 72 72 78 S108 100 132 74 S170 30 194 52 S227 88 250 56 S279 28 308 18"
                  stroke="url(#analytics-sync-line)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={isError ? "" : "animate-pulse-soft"}
                />
                <path
                  d="M12 102 C38 96 45 72 72 78 S108 100 132 74 S170 30 194 52 S227 88 250 56 S279 28 308 18"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="5 9"
                  strokeLinecap="round"
                  opacity="0.45"
                  className={isError ? "" : "animate-indeterminate-bar"}
                />
                {[
                  { cx: 72, cy: 78, delay: "0ms" },
                  { cx: 132, cy: 74, delay: "350ms" },
                  { cx: 194, cy: 52, delay: "700ms" },
                  { cx: 250, cy: 56, delay: "1050ms" },
                  { cx: 308, cy: 18, delay: "1400ms" },
                ].map((node) => (
                  <circle
                    key={`${node.cx}-${node.cy}`}
                    cx={node.cx}
                    cy={node.cy}
                    r="5"
                    fill="currentColor"
                    className={isError ? "" : "animate-pulse-soft"}
                    style={{ animationDelay: node.delay }}
                  />
                ))}
              </svg>
              <div className="absolute inset-x-0 bottom-0 flex justify-center gap-5 text-[11px] text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-primary" />
                  Views
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Engagement
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Audience
                </span>
              </div>
            </div>

            <div className="flex justify-center">
              {isError ? (
                <div className="p-3 bg-red-400/10 rounded-full">
                  <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
              ) : isSuccess ? (
                <div className="p-3 bg-green-400/10 rounded-full">
                  <CheckCircle2 className="h-7 w-7 text-green-400" />
                </div>
              ) : (
                <div className="p-3 bg-accent-primary/10 rounded-full">
                  <Activity className="h-7 w-7 text-accent-primary animate-pulse-soft" />
                </div>
              )}
            </div>

            <h2
              id={headlineId}
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {headline}
            </h2>

            {!isError && (
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-background-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-[width] duration-[2000ms] ease-linear"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{isSuccess ? "Complete" : "Refreshing data"}</span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5" />
                    {isSuccess ? "Ready now" : "About 1 minute"}
                  </span>
                </div>
              </div>
            )}

            {isError ? (
              <div className="space-y-4">
                <p className="text-text-muted text-sm">{message}</p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors rounded-lg border border-border-primary"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-text-muted text-sm flex items-center justify-center gap-2">
                {!isSuccess && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSuccess ? "Your latest analytics are ready." : statusLabel}
              </p>
            )}
          </div>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {isError ? message : statusLabel}
      </div>
    </>
  );
}
