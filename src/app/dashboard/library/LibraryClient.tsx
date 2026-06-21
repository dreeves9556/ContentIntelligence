"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search, Video, Images, FileText, User, GraduationCap, MapPin, Music, Clock, MessageCircle, BookOpen, CheckCircle2 } from "lucide-react";
import { CopyButton } from "@/components/CopyButton";
import type { ContentFormat, ContentBucket, CalendarDay } from "@/app/dashboard/calendar/actions";

interface SavedCalendar {
  id: string;
  weekNumber: number;
  createdAt: string;
  days: CalendarDay[];
  weekStarting: string;
  postedDayIndices: boolean[];
}

function FormatBadge({ format }: { format: string }) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    Reel: { icon: Video, color: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
    Carousel: { icon: Images, color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
    Static: { icon: FileText, color: "text-green-400 bg-green-400/10 border-green-400/30" },
  };
  const entry = map[format] ?? { icon: FileText, color: "text-text-muted bg-background-secondary border-background-secondary" };
  const Icon = entry.icon;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${entry.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {format}
    </div>
  );
}

function BucketBadge({ bucket }: { bucket: string }) {
  const map: Record<string, { icon: React.ElementType; color: string }> = {
    Personal: { icon: User, color: "text-brand-personal bg-brand-personal/10 border-brand-personal/30" },
    Expert: { icon: GraduationCap, color: "text-brand-expert bg-brand-expert/10 border-brand-expert/30" },
    Local: { icon: MapPin, color: "text-brand-local bg-brand-local/10 border-brand-local/30" },
  };
  const entry = map[bucket] ?? { icon: FileText, color: "text-text-muted bg-background-secondary border-background-secondary" };
  const Icon = entry.icon;
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${entry.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {bucket}
    </div>
  );
}

function DayDetail({ day }: { day: CalendarDay }) {
  return (
    <div className="bg-background-card rounded-xl border border-background-secondary overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-background-secondary bg-gradient-to-r from-background-secondary/50 to-transparent">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs font-bold tracking-wider text-text-muted uppercase">{day.day}</span>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <FormatBadge format={day.format} />
            <BucketBadge bucket={day.bucket} />
          </div>
        </div>
        <h3 className="text-lg font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-playfair)" }}>
          {day.title}
        </h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider text-accent-primary uppercase">Hook</span>
            <CopyButton text={day.hook} />
          </div>
          <p className="text-sm text-text-primary leading-relaxed font-medium">{day.hook}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider text-text-muted uppercase">Body</span>
            <CopyButton text={day.body} />
          </div>
          <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">{day.body}</p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-wider text-brand-expert uppercase">Call to Action</span>
            <CopyButton text={day.cta} />
          </div>
          <p className="text-sm text-brand-expert leading-relaxed font-medium">{day.cta}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-background-secondary/30 border-t border-background-secondary space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-text-muted">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Caption</span>
            </div>
            <CopyButton text={day.caption} />
          </div>
          <p className="text-xs text-text-muted leading-relaxed">{day.caption}</p>
        </div>
        {(day.musicSuggestion || day.duration) && (
          <div className="flex flex-wrap gap-3 pt-2 border-t border-background-secondary/50">
            {day.musicSuggestion && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Music className="h-3.5 w-3.5 text-accent-primary" />
                <span>{day.musicSuggestion}</span>
              </div>
            )}
            {day.duration && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted">
                <Clock className="h-3.5 w-3.5 text-accent-primary" />
                <span>{day.duration}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function WeekCard({ calendar }: { calendar: SavedCalendar }) {
  const postedDayIndices = calendar.postedDayIndices ?? [];
  const [expanded, setExpanded] = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [bucketFilter, setBucketFilter] = useState<string>("All");
  const [formatFilter, setFormatFilter] = useState<string>("All");

  const filteredDays = calendar.days
    .map((d, i) => ({ ...d, originalIndex: i }))
    .filter((d) => {
      const bucketMatch = bucketFilter === "All" || d.bucket === bucketFilter;
      const formatMatch = formatFilter === "All" || d.format === formatFilter;
      return bucketMatch && formatMatch;
    });

  const visibleDay = filteredDays[activeDay] ?? filteredDays[0];

  const weekDate = new Date(calendar.weekStarting);
  const endDate = new Date(weekDate);
  endDate.setDate(weekDate.getDate() + 6);
  const dateRange = `${weekDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const reelCount = calendar.days.filter((d) => d.format === "Reel").length;
  const carouselCount = calendar.days.filter((d) => d.format === "Carousel").length;
  const staticCount = calendar.days.filter((d) => d.format === "Static").length;

  return (
    <div className="bg-background-card rounded-xl border border-background-secondary overflow-hidden transition-all duration-300 hover:border-accent-primary/20">
      {/* Week header — always visible */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full p-5 flex items-center justify-between gap-4 text-left hover:bg-background-secondary/30 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-primary/10 rounded-lg">
              <BookOpen className="h-5 w-5 text-accent-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
                  Week {calendar.weekNumber}
                </span>
                <span className="text-xs text-text-muted bg-background-secondary px-2 py-0.5 rounded-full">
                  {calendar.days.length} days
                </span>
              </div>
              <span className="text-sm text-text-muted">{dateRange}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:ml-4">
            {reelCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-purple-400/10 text-purple-400 border border-purple-400/20 font-medium">
                {reelCount} Reel{reelCount !== 1 ? "s" : ""}
              </span>
            )}
            {carouselCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-400/10 text-blue-400 border border-blue-400/20 font-medium">
                {carouselCount} Carousel{carouselCount !== 1 ? "s" : ""}
              </span>
            )}
            {staticCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-md bg-green-400/10 text-green-400 border border-green-400/20 font-medium">
                {staticCount} Static{staticCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-text-muted">
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Expanded week view */}
      {expanded && (
        <div className="border-t border-background-secondary p-5 space-y-5">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-medium">Bucket:</span>
              {["All", "Personal", "Expert", "Local"].map((b) => (
                <button
                  key={b}
                  onClick={() => { setBucketFilter(b); setActiveDay(0); }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    bucketFilter === b
                      ? "bg-accent-primary text-background-primary"
                      : "bg-background-secondary text-text-muted hover:text-text-primary"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted font-medium">Format:</span>
              {["All", "Reel", "Carousel", "Static"].map((f) => (
                <button
                  key={f}
                  onClick={() => { setFormatFilter(f); setActiveDay(0); }}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    formatFilter === f
                      ? "bg-accent-primary text-background-primary"
                      : "bg-background-secondary text-text-muted hover:text-text-primary"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {filteredDays.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">No days match the selected filters.</p>
          ) : (
            <>
              {/* Day tabs */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {filteredDays.map((day, idx) => {
                  const isPosted = postedDayIndices[day.originalIndex] ?? false;
                  return (
                    <button
                      key={day.day}
                      onClick={() => setActiveDay(idx)}
                      className={`relative shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase transition-all duration-200 ${
                        idx === activeDay
                          ? "bg-accent-primary text-background-primary shadow-lg shadow-accent-primary/20"
                          : "bg-background-secondary text-text-muted hover:text-text-primary hover:bg-background-card"
                      }`}
                    >
                      {day.day.slice(0, 3)}
                      {isPosted && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 fill-background-secondary" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Active day detail */}
              {visibleDay && <DayDetail day={visibleDay} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LibraryClient({ calendars }: { calendars: SavedCalendar[] }) {
  const [search, setSearch] = useState("");

  const filtered = calendars.filter((cal) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return cal.days.some(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.hook.toLowerCase().includes(q) ||
        d.body.toLowerCase().includes(q) ||
        d.bucket.toLowerCase().includes(q) ||
        d.format.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, hook, bucket, or format…"
          className="w-full pl-10 pr-4 py-2.5 bg-background-card border border-background-secondary rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/50 text-sm"
        />
      </div>

      {/* Results count when searching */}
      {search.trim() && (
        <p className="text-sm text-text-muted">
          {filtered.length === 0
            ? "No calendars match your search."
            : `${filtered.length} week${filtered.length !== 1 ? "s" : ""} match your search`}
        </p>
      )}

      {/* Week list */}
      <div className="space-y-4">
        {filtered.map((cal) => (
          <WeekCard key={cal.id} calendar={cal} />
        ))}
      </div>
    </div>
  );
}
