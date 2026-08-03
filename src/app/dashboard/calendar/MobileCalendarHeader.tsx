"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, Video, Images, FileText, Info, ExternalLink } from "lucide-react";
import { parseLocalDate } from "@/lib/best-time";
import { GenerateButton } from "./GenerateButton";
import { MobileBottomSheet } from "@/components/mobile/MobileBottomSheet";

/**
 * Phone-only compact calendar header.
 * Renders: compact page title, week toolbar (label + icon regenerate + context),
 * and a Legend trigger that opens a bottom sheet with content-type + bucket legends.
 *
 * ≥sm renders the existing page.tsx blocks (this component is wrapped in sm:hidden).
 */
export function MobileCalendarHeader({ weekStarting, daysCount }: { weekStarting: string; daysCount: number }) {
  const [legendOpen, setLegendOpen] = useState(false);

  const weekLabel = parseLocalDate(weekStarting).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const weekEnd = (() => {
    const d = parseLocalDate(weekStarting);
    d.setDate(d.getDate() + 6);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  })();

  return (
    <div className="sm:hidden space-y-3">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
        Content Calendar
      </h1>

      {/* Compact week toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-background-card rounded-lg border border-border-primary min-h-[44px]">
          <Calendar className="h-4 w-4 text-accent-primary shrink-0" />
          <span className="text-sm text-text-primary font-medium">
            {weekLabel}–{weekEnd}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/questionnaire#weekly-context"
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10 transition-colors min-h-[44px]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Context
          </Link>
          <div className="min-h-[44px] flex items-center">
            <GenerateButton regenerate iconOnly defaultDaysToPost={daysCount} />
          </div>
          <button
            type="button"
            onClick={() => setLegendOpen(true)}
            aria-label="View legend"
            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-text-muted hover:text-text-primary hover:bg-background-secondary border border-border-primary"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      <MobileBottomSheet
        open={legendOpen}
        onOpenChange={setLegendOpen}
        title="Legend"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm text-text-muted font-medium">Content Types</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-text-primary">Reel</span>
              </div>
              <div className="flex items-center gap-2">
                <Images className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-text-primary">Carousel</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-400" />
                <span className="text-sm text-text-primary">Static</span>
              </div>
            </div>
          </div>
          <div className="space-y-2 pt-4 border-t border-border-primary">
            <p className="text-sm text-text-muted font-medium">Buckets</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-brand-personal/20 border border-brand-personal" />
                <span className="text-sm text-text-primary">Personal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-brand-expert/20 border border-brand-expert" />
                <span className="text-sm text-text-primary">Expert</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-brand-local/20 border border-brand-local" />
                <span className="text-sm text-text-primary">Local</span>
              </div>
            </div>
          </div>
        </div>
      </MobileBottomSheet>
    </div>
  );
}
