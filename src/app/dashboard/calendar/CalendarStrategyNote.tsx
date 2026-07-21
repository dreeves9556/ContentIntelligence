"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2, ChevronUp, ChevronDown } from "lucide-react";
import { getCachedCalendarStrategy } from "./actions";

const HIGHLIGHTS = [
  { phrase: "local community content", className: "text-brand-local font-semibold" },
  { phrase: "expert authority", className: "text-brand-expert font-semibold" },
  { phrase: "personal storytelling", className: "text-brand-personal font-semibold" },
];

function HighlightedText({ text }: { text: string }) {
  // Split text by highlight phrases, preserving them with their className
  let parts: { text: string; className?: string }[] = [{ text }];

  for (const { phrase, className } of HIGHLIGHTS) {
    const nextParts: { text: string; className?: string }[] = [];
    for (const part of parts) {
      if (part.className) {
        nextParts.push(part);
        continue;
      }
      const regex = new RegExp(`(${escapeRegExp(phrase)})`, "gi");
      const segments = part.text.split(regex);
      for (const segment of segments) {
        if (segment.toLowerCase() === phrase.toLowerCase()) {
          nextParts.push({ text: segment, className });
        } else {
          nextParts.push({ text: segment });
        }
      }
    }
    parts = nextParts;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.className ? (
          <span key={i} className={part.className}>
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  );
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function CalendarStrategyNote() {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightExpanded, setInsightExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getCachedCalendarStrategy().then((result) => {
      if (cancelled) return;
      if (result.success && result.insight) {
        setInsight(result.insight);
      } else {
        setError(result.error || "Unable to load strategy note");
      }
    }).catch((fetchError) => {
      if (cancelled) return;
      console.error("Calendar strategy fetch error:", fetchError);
      setError("Failed to load strategy note");
    }).finally(() => {
      if (cancelled) return;
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="bg-gradient-to-r from-accent-primary/20 via-accent-primary/10 to-transparent border border-accent-primary/30 rounded-xl p-6">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-accent-primary/20 rounded-lg shrink-0">
          {loading ? (
            <Loader2 className="h-6 w-6 text-accent-primary animate-spin" />
          ) : (
            <Sparkles className="h-6 w-6 text-accent-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-lg font-semibold text-accent-primary">
              AI Strategy Note
            </h3>
            {insight && !loading && (
              <button
                onClick={() => setInsightExpanded((v) => !v)}
                className="sm:hidden flex items-center gap-1 text-xs text-accent-primary/70 hover:text-accent-primary transition-colors shrink-0"
                aria-label={insightExpanded ? "Collapse strategy note" : "Expand strategy note"}
              >
                {insightExpanded ? (
                  <>
                    Less <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    More <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            )}
          </div>
          {loading && (
            <p className="text-text-muted leading-relaxed">Analyzing this week&apos;s content strategy...</p>
          )}
          {error && (
            <p className="text-text-muted leading-relaxed">{error}</p>
          )}
          {insight && !loading && (
            <>
              {/* Mobile: collapsed shows first sentence only */}
              <p className="sm:hidden text-text-primary leading-relaxed">
                <HighlightedText
                  text={
                    insightExpanded
                      ? insight
                      : (insight.match(/^[^.!?]+[.!?]/)?.[0] ?? insight.slice(0, 120) + (insight.length > 120 ? "\u2026" : ""))
                  }
                />
              </p>
              {/* Desktop: always show full note */}
              <p className="hidden sm:block text-text-primary leading-relaxed">
                <HighlightedText text={insight} />
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
