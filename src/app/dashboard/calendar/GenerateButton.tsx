"use client";

import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";
import { DaysSlider } from "./DaysSlider";
import { useCalendarGeneration } from "./CalendarGenerationContext";

interface GenerateButtonProps {
  regenerate?: boolean;
  /** When true, renders an icon-only button with an accessible label (no visible text). Phone-only use. */
  iconOnly?: boolean;
  /** Pre-fill for the regenerate days-per-week popup. Defaults to 3. */
  defaultDaysToPost?: number;
}

export function GenerateButton({ regenerate = false, iconOnly = false, defaultDaysToPost = 3 }: GenerateButtonProps) {
  const { startNewGeneration, isBusy } = useCalendarGeneration();
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [daysToPost, setDaysToPost] = useState<number>(
    Number.isInteger(defaultDaysToPost) && defaultDaysToPost >= 1 && defaultDaysToPost <= 7
      ? defaultDaysToPost
      : 3,
  );

  function onClickButton() {
    if (regenerate) {
      setShowDaysModal(true);
    } else {
      startNewGeneration();
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${regenerate ? "" : "w-full max-w-md"}`}>
      <button
        onClick={onClickButton}
        disabled={isBusy}
        aria-label={regenerate ? "Regenerate calendar" : "Generate calendar"}
        title={regenerate ? "Regenerate calendar" : "Generate calendar"}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:px-6 sm:py-3 sm:text-base
          ${iconOnly ? "min-w-[44px] min-h-[44px] justify-center" : ""}
          ${
            regenerate
              ? "bg-background-card hover:bg-background-secondary border border-border-primary text-text-primary"
              : "bg-accent-primary hover:bg-accent-primary/90 text-white"
          }
        `}
      >
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
            {!iconOnly && (regenerate ? "Regenerating calendar..." : "Generating calendar...")}
          </>
        ) : (
          <>
            {regenerate ? (
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            {!iconOnly && (regenerate ? "Regenerate Calendar" : "Generate My Week 1 Calendar")}
          </>
        )}
      </button>

      {!isBusy && !iconOnly && (
        <Link
          href="/dashboard/questionnaire#weekly-context"
          className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Add weekly context
        </Link>
      )}

      {/* Regenerate days-per-week popup */}
      {showDaysModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background-card rounded-2xl border border-border-primary p-6 sm:p-8 max-w-md w-full space-y-5">
            <div className="text-center space-y-2">
              <div className="p-3 bg-accent-primary/10 rounded-full w-fit mx-auto">
                <RefreshCw className="h-6 w-6 text-accent-primary" />
              </div>
              <h2 className="text-xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
                Regenerate Calendar
              </h2>
              <p className="text-text-muted text-sm">
                Choose how many days of content to generate. This becomes your new default.
              </p>
            </div>
            <DaysSlider value={daysToPost} onChange={setDaysToPost} />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDaysModal(false)}
                disabled={isBusy}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDaysModal(false);
                  startNewGeneration(daysToPost);
                }}
                disabled={isBusy}
                className="flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-accent-primary hover:bg-accent-primary/90 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Generate {daysToPost}-day calendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
