"use client";

import type { ContentFormat, ContentBucket, CalendarDay } from "./actions";
import { CopyButton } from "@/components/CopyButton";
import { MobileTabs } from "@/components/mobile/MobileTabs";
import {
  Video,
  Images,
  FileText,
  User,
  GraduationCap,
  MapPin,
  Music,
  Clock,
  MessageCircle,
  Lightbulb,
  ExternalLink,
  CheckCircle2,
  Circle,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
} from "lucide-react";
import {
  bestSlotForDay,
  formatHour,
  dayNameToIndex,
  heatmapToLocalTime,
  getTimezoneOffsetHours,
  parseLocalDate,
  type HeatmapData,
} from "@/lib/best-time";

type Platform = "instagram" | "tiktok" | "youtube" | "facebook" | "linkedin";

const PLATFORM_INFO: Record<Platform, { label: string; url: string; color: string }> = {
  instagram: { label: "Instagram", url: "https://www.instagram.com/", color: "from-blue-600 via-purple-600 to-pink-500" },
  tiktok: { label: "TikTok", url: "https://www.tiktok.com/upload", color: "from-black to-neutral-800" },
  youtube: { label: "YouTube", url: "https://www.youtube.com/upload", color: "from-red-600 to-red-700" },
  facebook: { label: "Facebook", url: "https://www.facebook.com/", color: "from-blue-600 to-blue-700" },
  linkedin: { label: "LinkedIn", url: "https://www.linkedin.com/feed/?doFeedActivity=true", color: "from-blue-700 to-blue-800" },
};

const FORMAT_PLATFORMS: Record<ContentFormat, Platform[]> = {
  Reel: ["instagram", "tiktok", "youtube", "facebook"],
  Carousel: ["instagram", "linkedin", "facebook"],
  Static: ["instagram", "linkedin", "facebook"],
};

function FormatBadge({ format }: { format: ContentFormat }) {
  const icons = { Reel: Video, Carousel: Images, Static: FileText };
  const colors = {
    Reel: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    Carousel: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    Static: "text-green-400 bg-green-400/10 border-green-400/30",
  };
  const Icon = icons[format];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${colors[format]}`}>
      <Icon className="h-3.5 w-3.5" />
      {format}
    </div>
  );
}

function BucketBadge({ bucket }: { bucket: ContentBucket }) {
  const icons = { Personal: User, Expert: GraduationCap, Local: MapPin };
  const colors = {
    Personal: "text-brand-personal bg-brand-personal/10 border-brand-personal/30",
    Expert: "text-brand-expert bg-brand-expert/10 border-brand-expert/30",
    Local: "text-brand-local bg-brand-local/10 border-brand-local/30",
  };
  const Icon = icons[bucket];
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold ${colors[bucket]}`}>
      <Icon className="h-3.5 w-3.5" />
      {bucket}
    </div>
  );
}

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
type TimeSlot = { platform: string; time: string; note?: string };

export interface CalendarBestTimeEntry {
  platform: string;
  heatmap: HeatmapData;
}

// Shared with desktop DayCard — duplicated here to keep the mobile card self-contained
// without importing private helpers from CalendarClient.tsx. Values are static.
const bestTimesByFormatAndDay: Record<ContentFormat, Record<DayOfWeek, TimeSlot[]>> = {
  Reel: {
    MONDAY: [
      { platform: "Instagram", time: "12 PM / 5 PM", note: "Lunch + commute" },
      { platform: "TikTok", time: "7–9 PM", note: "Evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
    TUESDAY: [
      { platform: "Instagram", time: "11 AM–1 PM / 8 PM", note: "Top Reel day" },
      { platform: "TikTok", time: "7–9 PM", note: "Peak evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
    WEDNESDAY: [
      { platform: "Instagram", time: "11 AM–1 PM / 8 PM", note: "Highest engagement" },
      { platform: "TikTok", time: "7–9 PM", note: "Peak evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
    THURSDAY: [
      { platform: "Instagram", time: "11 AM–1 PM / 7 PM", note: "Strong evening" },
      { platform: "TikTok", time: "7–9 PM", note: "Peak evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
    FRIDAY: [
      { platform: "Instagram", time: "11 AM / 7 PM", note: "Light weekend lead-in" },
      { platform: "TikTok", time: "7–9 PM", note: "Evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
    SATURDAY: [
      { platform: "Instagram", time: "9–11 AM", note: "Morning discovery" },
      { platform: "TikTok", time: "7–9 PM", note: "Evening" },
      { platform: "Facebook", time: "9–11 AM", note: "Morning scroll" },
    ],
    SUNDAY: [
      { platform: "Instagram", time: "6–9 PM", note: "Seller-focused window" },
      { platform: "TikTok", time: "7–9 PM", note: "Evening" },
      { platform: "Facebook", time: "6–9 PM", note: "Wind-down" },
    ],
  },
  Carousel: {
    MONDAY: [
      { platform: "Instagram", time: "8–10 AM", note: "Morning learn" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
      { platform: "Facebook", time: "12–2 PM", note: "Lunch break" },
    ],
    TUESDAY: [
      { platform: "Instagram", time: "8–11 AM", note: "Best carousel day" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
      { platform: "Facebook", time: "12–2 PM", note: "Lunch break" },
    ],
    WEDNESDAY: [
      { platform: "Instagram", time: "8–11 AM", note: "Best carousel day" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
      { platform: "Facebook", time: "12–2 PM", note: "Lunch break" },
    ],
    THURSDAY: [
      { platform: "Instagram", time: "8–11 AM", note: "Strong morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
      { platform: "Facebook", time: "12–2 PM / 4–6 PM", note: "Midday + late afternoon" },
    ],
    FRIDAY: [
      { platform: "Instagram", time: "8–10 AM", note: "Morning learn" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
      { platform: "Facebook", time: "12–2 PM", note: "Lunch break" },
    ],
    SATURDAY: [
      { platform: "Instagram", time: "9–11 AM", note: "Morning scroll" },
      { platform: "Facebook", time: "9–11 AM", note: "Morning scroll" },
      { platform: "LinkedIn", time: "10 AM", note: "Weekend browse" },
    ],
    SUNDAY: [
      { platform: "Instagram", time: "10 AM", note: "Sunday planning" },
      { platform: "LinkedIn", time: "10 AM", note: "Weekend browse" },
      { platform: "Facebook", time: "12–2 PM", note: "Afternoon scroll" },
    ],
  },
  Static: {
    MONDAY: [
      { platform: "Instagram", time: "9–11 AM", note: "Morning catch-up" },
      { platform: "Facebook", time: "9 AM–12 PM", note: "Weekday morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
    ],
    TUESDAY: [
      { platform: "Instagram", time: "9–11 AM / 1–3 PM", note: "Lunch break" },
      { platform: "Facebook", time: "9 AM–12 PM", note: "Weekday morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
    ],
    WEDNESDAY: [
      { platform: "Instagram", time: "9–11 AM / 1–3 PM", note: "Midday peak" },
      { platform: "Facebook", time: "9 AM–12 PM", note: "Weekday morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
    ],
    THURSDAY: [
      { platform: "Instagram", time: "9–11 AM / 1–3 PM", note: "Midday peak" },
      { platform: "Facebook", time: "9 AM–12 PM", note: "Weekday morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
    ],
    FRIDAY: [
      { platform: "Instagram", time: "9–11 AM", note: "Morning catch-up" },
      { platform: "Facebook", time: "9 AM–12 PM", note: "Weekday morning" },
      { platform: "LinkedIn", time: "8–10 AM", note: "Morning commute" },
    ],
    SATURDAY: [
      { platform: "Instagram", time: "2–3 PM / 8 AM", note: "Weekend afternoon" },
      { platform: "Facebook", time: "9–11 AM", note: "Morning scroll" },
      { platform: "LinkedIn", time: "10 AM", note: "Weekend browse" },
    ],
    SUNDAY: [
      { platform: "Instagram", time: "7 PM / 2–3 PM", note: "Evening planning" },
      { platform: "Facebook", time: "9–11 AM", note: "Morning scroll" },
      { platform: "LinkedIn", time: "10 AM", note: "Weekend browse" },
    ],
  },
};

function parseCarouselSlides(body: string): { label: string; text: string }[] {
  const slidePattern = /(?:^|\n)(Slide\s*\d+\s*[:\-]\s*)([^\n]*(?:\n(?!\s*Slide\s*\d+\s*[:\-])[^\n]*)*)/gi;
  const slides: { label: string; text: string }[] = [];
  let match;
  while ((match = slidePattern.exec(body)) !== null) {
    const label = match[1].trim().replace(/\s+/g, " ");
    const text = match[2].trim();
    if (text) slides.push({ label, text });
  }
  if (slides.length > 0) return slides;

  const lines = body.split(/\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [{ label: "Slide 1", text: body.trim() }];

  const numberedPattern = /^\d+\.\s+/;
  if (lines.every((l) => numberedPattern.test(l))) {
    return lines.map((l, i) => {
      const text = l.replace(numberedPattern, "").trim();
      return { label: `Slide ${i + 1}`, text };
    });
  }

  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs.map((p, i) => ({ label: `Slide ${i + 1}`, text: p }));
  }

  return [{ label: "Slide 1", text: body.trim() }];
}

function SectionHeader({
  icon: Icon,
  label,
  copyText,
  copyLabel,
  iconClass = "text-accent-primary",
}: {
  icon: typeof Video;
  label: string;
  copyText?: string;
  copyLabel?: string;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <span className="text-xs font-bold tracking-wider uppercase">{label}</span>
      </div>
      {copyText && copyLabel && <CopyButton text={copyText} label={copyLabel} iconOnly />}
    </div>
  );
}

export function MobileDayCard({
  day,
  dayIndex,
  weekStarting,
  isPosted,
  onTogglePosted,
  isPostedPending,
  isFeedbackPending,
  connectedPlatforms,
  bestTimes,
  feedback,
  onFeedback,
  onTweak,
  canTweak,
}: {
  day: CalendarDay;
  dayIndex: number;
  weekStarting: string;
  isPosted: boolean;
  onTogglePosted: () => void;
  isPostedPending: boolean;
  isFeedbackPending: boolean;
  connectedPlatforms: string[];
  bestTimes: CalendarBestTimeEntry[];
  feedback: "up" | "down" | null;
  onFeedback: (value: "up" | "down") => void;
  onTweak?: () => void;
  canTweak?: boolean;
}) {
  const fullScript = [day.hook, day.body, day.cta].filter(Boolean).join("\n\n");
  const hasDirections = !!day.directions;
  const hasMusicOrDuration = !!(day.musicSuggestion || day.duration);

  const dayIdx = dayNameToIndex(day.day);
  const realTimeSlots: TimeSlot[] = [];
  if (dayIdx >= 0) {
    const offsetHours = getTimezoneOffsetHours();
    for (const entry of bestTimes) {
      const localHeatmap = heatmapToLocalTime(entry.heatmap, offsetHours);
      const slot = bestSlotForDay(localHeatmap.grid, dayIdx);
      if (slot) {
        const platformLabel = entry.platform.charAt(0).toUpperCase() + entry.platform.slice(1);
        realTimeSlots.push({ platform: platformLabel, time: formatHour(slot.hour) });
      }
    }
  }
  const hasRealData = realTimeSlots.length > 0;
  const fallbackSlots = bestTimesByFormatAndDay[day.format][day.day as DayOfWeek];

  const dateForDay = parseLocalDate(weekStarting);
  dateForDay.setDate(dateForDay.getDate() + dayIndex);
  const dateline = dateForDay.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const eligiblePlatforms = FORMAT_PLATFORMS[day.format].filter((p) =>
    connectedPlatforms.includes(p)
  );

  const createTab = (
    <div className="space-y-4 px-4 py-4">
      {hasDirections && (
        <div className="space-y-2">
          <SectionHeader icon={Lightbulb} label="How to Make This" iconClass="text-brand-expert" />
          <p className="text-base text-text-primary leading-relaxed whitespace-pre-line">
            {day.directions}
          </p>
        </div>
      )}
      {hasMusicOrDuration && (
        <div className="space-y-2 pt-2 border-t border-border-primary/60">
          <SectionHeader icon={Clock} label="Production Notes" />
          <div className="space-y-2">
            {day.musicSuggestion && (
              <div className="flex items-start gap-2 text-sm text-text-secondary">
                <Music className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
                <span>{day.musicSuggestion}</span>
              </div>
            )}
            {day.duration && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Clock className="h-4 w-4 text-accent-primary shrink-0" />
                <span>{day.duration}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {!hasDirections && !hasMusicOrDuration && (
        <p className="text-sm text-text-muted">No production guidance for this post.</p>
      )}
    </div>
  );

  const scriptTab = (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-accent-primary">
          {day.format === "Reel" ? (
            <Video className="h-4 w-4 shrink-0" />
          ) : day.format === "Carousel" ? (
            <Images className="h-4 w-4 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 shrink-0" />
          )}
          <span className="text-xs font-bold tracking-wider uppercase">
            {day.format === "Reel" ? "On-Camera Script" : day.format === "Static" ? "On-Image Text" : "Post Content"}
          </span>
        </div>
        <CopyButton text={fullScript} label={day.format === "Reel" ? "Copy script" : day.format === "Static" ? "Copy image text" : "Copy content"} iconOnly />
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <SectionHeader
            icon={MessageCircle}
            label={day.format === "Reel" ? "Hook" : "Headline"}
            copyText={day.hook}
            copyLabel={day.format === "Reel" ? "Copy hook" : "Copy headline"}
            iconClass="text-accent-primary"
          />
          <p className="text-base text-text-primary leading-relaxed font-medium">{day.hook}</p>
        </div>

        {day.format === "Carousel" ? (
          (() => {
            const slides = parseCarouselSlides(day.body);
            return (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold tracking-wider text-text-muted uppercase">Slides</span>
                  <CopyButton text={day.body} label="Copy all" iconOnly />
                </div>
                {slides.map((slide, i) => (
                  <div key={i} className="rounded-lg border border-border-primary/60 bg-background-secondary/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold tracking-wider text-accent-primary/80 uppercase">{slide.label}</span>
                      <CopyButton text={slide.text} label="Copy slide" iconOnly />
                    </div>
                    <p className="text-base text-text-secondary leading-relaxed whitespace-pre-line">{slide.text}</p>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          <div className="space-y-1.5">
            <SectionHeader
              icon={FileText}
              label={day.format === "Static" ? "Image Text" : "Body"}
              copyText={day.body}
              copyLabel={day.format === "Static" ? "Copy image text" : "Copy body"}
              iconClass="text-text-muted"
            />
            <p className="text-base text-text-secondary leading-relaxed whitespace-pre-line">{day.body}</p>
          </div>
        )}

        {/* CTA — hidden for Static (CTA lives in the caption) */}
        {day.format !== "Static" && (
          <div className="space-y-1.5">
            <SectionHeader
              icon={MessageCircle}
              label="Call to Action"
              copyText={day.cta}
              copyLabel="Copy CTA"
              iconClass="text-brand-expert"
            />
            <p className="text-base text-brand-expert leading-relaxed font-medium">{day.cta}</p>
          </div>
        )}
      </div>
    </div>
  );

  const captionTab = (
    <div className="px-4 py-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-text-muted">
          <MessageCircle className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold tracking-wider uppercase">Caption</span>
        </div>
        <CopyButton text={day.caption} label="Copy caption" iconOnly />
      </div>
      <div className="border-t border-border-primary pt-3">
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
          {day.caption}
        </p>
      </div>
    </div>
  );

  const publishTab = (
    <div className="space-y-5 px-4 py-4">
      {/* Best Time to Post */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-accent-primary">
          <Clock className="h-4 w-4 shrink-0" />
          <span className="text-xs font-bold tracking-wider uppercase">Best Time to Post</span>
          {hasRealData && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20 normal-case tracking-normal">
              from your data
            </span>
          )}
        </div>
        <div className="space-y-2">
          {(hasRealData ? realTimeSlots : fallbackSlots).map((item: TimeSlot) => (
            <div key={item.platform} className="flex items-start justify-between gap-3 text-sm">
              <span className="text-text-primary font-medium">{item.platform}</span>
              <div className="text-right">
                <span className="text-text-secondary">{item.time}</span>
                {item.note && <span className="block text-xs text-text-muted/70 mt-0.5">{item.note}</span>}
              </div>
            </div>
          ))}
          {!hasRealData && (
            <p className="text-xs text-text-muted/60 pt-1">
              Connect your accounts &amp; sync analytics to get real optimal times based on your engagement data.
            </p>
          )}
        </div>
      </div>

      {/* Post To Platform Links */}
      {eligiblePlatforms.length > 0 && (
        <div className="space-y-2.5 pt-4 border-t border-border-primary/60">
          <div className="flex items-center gap-2 text-accent-primary">
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold tracking-wider uppercase">Post To</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {eligiblePlatforms.map((platform) => {
              const info = PLATFORM_INFO[platform];
              return (
                <a
                  key={platform}
                  href={info.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br ${info.color} hover:opacity-90 transition-opacity min-h-[44px]`}
                >
                  {info.label}
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback */}
      <div className="space-y-2.5 pt-4 border-t border-border-primary/60">
        <div className="flex items-center gap-2 text-text-muted">
          <span className="text-xs font-bold tracking-wider uppercase">Was this suggestion helpful?</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onFeedback("up")}
            disabled={isFeedbackPending}
            aria-pressed={feedback === "up"}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-bold transition-all duration-200 min-h-[44px]
              ${isFeedbackPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
              ${feedback === "up"
                ? "bg-green-500/20 text-green-400 border border-green-500/40"
                : "bg-background-secondary/50 text-text-muted border border-border-primary hover:text-green-400 hover:border-green-500/20"
              }
            `}
          >
            <ThumbsUp className="h-4 w-4 shrink-0" />
            <span>Good</span>
          </button>
          <button
            onClick={() => onFeedback("down")}
            disabled={isFeedbackPending}
            aria-pressed={feedback === "down"}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
              text-sm font-bold transition-all duration-200 min-h-[44px]
              ${isFeedbackPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
              ${feedback === "down"
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "bg-background-secondary/50 text-text-muted border border-border-primary hover:text-red-400 hover:border-red-500/20"
              }
            `}
          >
            <ThumbsDown className="h-4 w-4 shrink-0" />
            <span>Off</span>
          </button>
        </div>
      </div>

      {/* Posted toggle */}
      <div className="pt-4 border-t border-border-primary/60">
        <button
          onClick={onTogglePosted}
          disabled={isPostedPending}
          className={`
            w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg
            text-sm font-bold tracking-wide transition-all duration-200 min-h-[44px]
            ${isPostedPending ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}
            ${isPosted
              ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/20"
              : "bg-background-secondary/50 text-text-muted border border-border-primary hover:text-text-primary hover:border-accent-primary/20 hover:bg-background-secondary/80"
            }
          `}
        >
          {isPosted ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 shrink-0" />
          )}
          <span>
            {isPostedPending ? "Saving..." : isPosted ? "Marked as posted" : "Mark as posted"}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className={`group bg-background-card rounded-xl border border-border-primary overflow-hidden transition-all duration-300 ${
        isPosted ? "opacity-60" : ""
      }`}
    >
      {/* Masthead — always visible */}
      <div className="px-4 pt-4 pb-3 border-b-2 border-text-primary">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-[0.15em] text-text-muted uppercase shrink-0">
            {dateline}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <FormatBadge format={day.format} />
            <BucketBadge bucket={day.bucket} />
          </div>
        </div>
        <div className="flex items-start justify-between gap-2 mt-2 mb-1">
          <h2 className="text-2xl font-bold text-text-primary leading-[1.15]" style={{ fontFamily: "var(--font-serif)" }}>
            {day.title}
          </h2>
          {canTweak && onTweak && (
            <button
              onClick={onTweak}
              className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-primary hover:text-accent-primary/80 border border-accent-primary/30 hover:border-accent-primary/50 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Sparkles className="h-4 w-4" /> Tweak
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs font-semibold tracking-wider text-accent-primary uppercase">
            {dateForDay.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()} Edition
          </span>
          <span className="h-px flex-1 bg-border-primary" />
        </div>
      </div>

      <MobileTabs
        tabs={[
          { id: "create", label: "Create", content: createTab },
          { id: "script", label: day.format === "Reel" ? "Script" : day.format === "Static" ? "Image" : "Content", content: scriptTab },
          { id: "caption", label: "Caption", content: captionTab },
          { id: "publish", label: "Publish", content: publishTab },
        ]}
      />
    </div>
  );
}
