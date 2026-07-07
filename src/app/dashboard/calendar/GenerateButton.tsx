"use client";

import { useState, useEffect } from "react";
import { generateWeeklyCalendar } from "./actions";
import { getTimezoneOffsetHours } from "@/lib/best-time";
import { Sparkles, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import Link from "next/link";

const statusSteps = [
  { label: "Analyzing your questionnaire...", progress: 15 },
  { label: "Building your content strategy...", progress: 35 },
  { label: "Generating your content calendar...", progress: 60 },
  { label: "Writing captions and hooks...", progress: 80 },
  { label: "Saving to your dashboard...", progress: 95 },
];

interface GenerateButtonProps {
  regenerate?: boolean;
}

export function GenerateButton({ regenerate = false }: GenerateButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState<string>("");

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      setStatusLabel("");
      return;
    }

    let currentStep = 0;
    setProgress(statusSteps[0].progress);
    setStatusLabel(statusSteps[0].label);

    const interval = setInterval(() => {
      currentStep = Math.min(currentStep + 1, statusSteps.length - 1);
      setProgress(statusSteps[currentStep].progress);
      setStatusLabel(statusSteps[currentStep].label);
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading]);

  async function handleGenerate() {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const result = await generateWeeklyCalendar(getTimezoneOffsetHours());
      if (!result.success) {
        setError(result.error || "Failed to generate calendar");
      } else {
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
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`flex flex-col items-center gap-3 ${regenerate ? "" : "w-full max-w-md"}`}>
      <button
        onClick={handleGenerate}
        disabled={isLoading}
        className={`
          flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed sm:px-6 sm:py-3 sm:text-base
          ${
            regenerate
              ? "bg-background-card hover:bg-background-secondary border border-border-primary text-text-primary"
              : "bg-accent-primary hover:bg-accent-primary/90 text-white"
          }
        `}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin sm:h-5 sm:w-5" />
            {regenerate ? "Regenerating calendar..." : "Generating calendar..."}
          </>
        ) : (
          <>
            {regenerate ? (
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            {regenerate ? "Regenerate Calendar" : "Generate My Week 1 Calendar"}
          </>
        )}
      </button>

      {!isLoading && (
        <Link
          href="/dashboard/profile"
          className="flex items-center gap-1 text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Add weekly context
        </Link>
      )}

      {isLoading && (
        <div className="w-full space-y-2">
          <div className="h-2 w-full rounded-full bg-background-secondary border border-border-primary overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-text-secondary text-center">{statusLabel}</p>
        </div>
      )}
      {error && (
        <p className="text-red-400 text-sm max-w-md text-center">{error}</p>
      )}
    </div>
  );
}
