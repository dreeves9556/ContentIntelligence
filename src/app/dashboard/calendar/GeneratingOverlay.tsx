"use client";

import { useEffect, useRef, useState } from "react";
import type { GenerationPhase } from "./CalendarGenerationContext";
import { Loader2, RefreshCw, AlertCircle, Clock } from "lucide-react";

interface GeneratingOverlayProps {
  phase: GenerationPhase;
  statusLabel: string;
  progress: number;
  daysToPost: number;
  isRegenerate: boolean;
  error: string | null;
  onRetry: () => void;
  onReturnToCalendar: () => void;
  onLoadNewCalendar: () => void;
  onKeepWaiting: () => void;
}

const FORMAT_COLORS = ["bg-purple-400", "bg-blue-400", "bg-green-400"];

const PRO_TIPS = [
  "Mark posts as \"Posted\" after you publish — the system tracks what you've used so it won't repeat similar content next week.",
  "Use the thumbs down on posts that miss the mark — the learning pipeline uses that feedback to improve future generations.",
  "Click \"Tweak\" on any calendar day to open the Refinement Panel with quick actions like \"Stronger CTA\" or \"Shorter hook.\"",
  "Visit the Library → Social 101 tab for platform-specific playbooks and automation workflows.",
  "Fill out the Brand Voice section in your questionnaire with signature phrases — AI posts will sound more like you.",
  "The Weekly Context survey resets every Sunday — fill it out to inject timely personal details into that week's calendar.",
  "The freshness system tracks which content archetypes you've overused and suggests underused ones automatically.",
  "Check the \"Best Time\" badge on each day card — it's calculated from your audience's real engagement data.",
  "Team admins can invite members via the Team page — Community plans get cheaper per seat as you grow.",
  "The questionnaire drives everything — more detail there means more personalized calendar posts.",
];

/** Rough ETA: full generation takes ~2 min. */
function estimateTimeRemaining(progress: number): string {
  if (progress <= 0) return "";
  if (progress >= 85) return "Almost done";
  const remainingSec = Math.ceil(((85 - progress) / 85) * 120);
  if (remainingSec <= 45) return "Less than 1 min left";
  const min = Math.ceil(remainingSec / 60);
  return `About ${min} min left`;
}

export function GeneratingOverlay({
  phase,
  statusLabel,
  progress,
  daysToPost,
  isRegenerate,
  error,
  onRetry,
  onReturnToCalendar,
  onLoadNewCalendar,
  onKeepWaiting,
}: GeneratingOverlayProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headlineId = "generation-overlay-headline";

  // Focus management: focus the dialog on mount, focus error text on error.
  useEffect(() => {
    if (dialogRef.current) {
      dialogRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if ((phase === "generation_error" || phase === "refresh_error" || phase === "unknown_outcome") && dialogRef.current) {
      const firstButton = dialogRef.current.querySelector("button");
      firstButton?.focus();
    }
  }, [phase]);

  const isExiting = phase === "exiting";
  const isError = phase === "generation_error" || phase === "refresh_error" || phase === "unknown_outcome";
  const isChecking = phase === "checking";
  const showTiles = !isError && !isChecking;
  const activeTile = Math.min(Math.floor((progress / 100) * daysToPost), daysToPost - 1);

  // Cycle through pro tips every 6 s while tiles are visible.
  const [tipIndex, setTipIndex] = useState(0);
  const [tipKey, setTipKey] = useState(0); // forces re-mount for CSS enter animation
  useEffect(() => {
    if (!showTiles) return;
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % PRO_TIPS.length);
      setTipKey((k) => k + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [showTiles]);

  const headline = isError
    ? phase === "generation_error"
      ? "Generation Failed"
      : phase === "refresh_error"
        ? "Couldn't Load New Calendar"
        : "Still Generating"
    : isRegenerate
      ? "Regenerating Your Calendar"
      : "Generating Your Calendar";

  return (
    <>
      {/* Backdrop — immediate, opaque, no entry animation. Fades out only on exit. */}
      <div
        className={`fixed inset-0 z-[60] overflow-y-auto bg-background-primary ${isExiting ? "animate-backdrop-out" : ""}`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Dialog — inner content animates in/out */}
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={headlineId}
          tabIndex={-1}
          className={`min-h-full flex flex-col items-center justify-center px-4 py-8 ${isExiting ? "animate-overlay-out" : "animate-overlay-in"}`}
        >
          <div className="w-full max-w-md space-y-6 text-center">
            {/* Icon */}
            {!isError && (
              <div className="flex justify-center">
                {isChecking ? (
                  <Loader2 className="h-10 w-10 text-accent-primary animate-spin" />
                ) : (
                  <div className="p-3 bg-accent-primary/10 rounded-full">
                    <Loader2 className="h-7 w-7 text-accent-primary animate-spin" />
                  </div>
                )}
              </div>
            )}
            {isError && (
              <div className="flex justify-center">
                <div className="p-3 bg-red-400/10 rounded-full">
                  <AlertCircle className="h-7 w-7 text-red-400" />
                </div>
              </div>
            )}

            {/* Headline */}
            <h2
              id={headlineId}
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {headline}
            </h2>

            {/* Day-tile animation */}
            {showTiles && (
              <div className="flex justify-center gap-2 flex-wrap" aria-hidden="true">
                {Array.from({ length: daysToPost }, (_, i) => (
                  <div
                    key={i}
                    className={`w-14 h-20 rounded-lg border border-border-primary bg-background-card overflow-hidden animate-day-tile-in ${
                      i === activeTile && !isExiting ? "animate-pulse-soft" : ""
                    }`}
                    style={{ animationDelay: `${i * 600}ms` }}
                  >
                    <div className={`h-2 w-full ${FORMAT_COLORS[i % 3]}`} />
                    <div className="p-1.5 space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-background-secondary" />
                      <div className="h-1.5 w-3/4 rounded-full bg-background-secondary" />
                      <div className="h-1.5 w-1/2 rounded-full bg-background-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Determinate progress bar + time estimate */}
            {showTiles && (
              <div className="space-y-2">
                <div className="h-1.5 w-full rounded-full bg-background-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-primary transition-[width] duration-[2000ms] ease-linear"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{progress}%</span>
                  {progress >= 85 ? (
                    <span>Almost done</span>
                  ) : progress > 0 ? (
                    <span>{estimateTimeRemaining(progress)}</span>
                  ) : null}
                </div>
              </div>
            )}

            {/* Checking state */}
            {isChecking && (
              <p className="text-text-muted text-sm flex items-center justify-center gap-2">
                <Clock className="h-4 w-4" />
                Checking your generation...
              </p>
            )}

            {/* Error states */}
            {phase === "generation_error" && (
              <div className="space-y-4">
                <p className="text-text-muted text-sm">{error || "An error occurred during generation."}</p>
                <p className="text-text-muted text-xs">Your previous calendar was not changed.</p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onReturnToCalendar}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors rounded-lg border border-border-primary"
                  >
                    Return to calendar
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
            )}

            {phase === "refresh_error" && (
              <div className="space-y-4">
                <p className="text-text-muted text-sm">
                  {error || "Your new calendar was generated, but it didn't load properly."}
                </p>
                <button
                  type="button"
                  onClick={onLoadNewCalendar}
                  className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors mx-auto"
                >
                  <RefreshCw className="h-4 w-4" />
                  Load new calendar
                </button>
              </div>
            )}

            {phase === "unknown_outcome" && (
              <div className="space-y-4">
                <p className="text-text-muted text-sm">
                  {error || "Your calendar may still be generating. You can wait or load the current calendar."}
                </p>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onLoadNewCalendar}
                    className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors rounded-lg border border-border-primary"
                  >
                    Load current calendar
                  </button>
                  <button
                    type="button"
                    onClick={onKeepWaiting}
                    className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors"
                  >
                    <Clock className="h-4 w-4" />
                    Keep waiting
                  </button>
                </div>
              </div>
            )}

            {/* Status label (visible to screen readers via the sibling aria-live element) */}
            {showTiles && (
              <p className="text-text-muted text-sm">{statusLabel}</p>
            )}

            {/* Pro tips carousel */}
            {showTiles && (
              <div className="rounded-xl border border-border-primary bg-background-secondary p-4 min-h-[60px] flex items-center justify-center">
                <p
                  key={tipKey}
                  className="text-xs text-text-muted leading-relaxed animate-tip-fade-in"
                >
                  <span className="font-semibold text-accent-primary">Pro tip: </span>
                  {PRO_TIPS[tipIndex]}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Separate aria-live status element — sibling to the dialog so screen readers
          hear status updates without the dialog role cutting them off. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusLabel}
      </div>
    </>
  );
}
