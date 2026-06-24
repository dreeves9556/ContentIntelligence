"use client";

import { useState, useEffect, useTransition } from "react";
import type { ContentFormat, ContentBucket, CalendarDay } from "./actions";
import { addToArchive, removeFromArchive } from "./actions";
import { CopyButton } from "@/components/CopyButton";
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
} from "lucide-react";

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
  const icons = {
    Reel: Video,
    Carousel: Images,
    Static: FileText,
  };
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

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

type TimeSlot = { platform: string; time: string; note?: string };

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

function BucketBadge({ bucket }: { bucket: ContentBucket }) {
  const icons = {
    Personal: User,
    Expert: GraduationCap,
    Local: MapPin,
  };
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

function DayCard({ day, isPosted, onTogglePosted, isPending, connectedPlatforms }: { day: CalendarDay; isPosted: boolean; onTogglePosted: () => void; isPending: boolean; connectedPlatforms: string[] }) {
  const fullScript = [day.hook, day.body, day.cta].filter(Boolean).join("\n\n");
  const hasDirections = !!day.directions;

  return (
    <div className={`group bg-background-card rounded-xl border border-background-secondary overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-accent-primary/5 ${isPosted ? "opacity-60 hover:border-accent-primary/30" : "hover:border-accent-primary/30"}`}>
      {/* Header */}
      <div className="p-4 border-b border-background-secondary bg-gradient-to-r from-background-secondary/50 to-transparent">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="text-xs font-bold tracking-wider text-text-muted uppercase shrink-0">
            {day.day}
          </span>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <FormatBadge format={day.format} />
            <BucketBadge bucket={day.bucket} />
          </div>
        </div>
        <h3 className="text-lg font-bold text-text-primary leading-tight" style={{ fontFamily: "var(--font-playfair)" }}>
          {day.title}
        </h3>
      </div>

      {/* Directions — how to film / perform */}
      {hasDirections && (
        <div className="p-4 border-t border-background-secondary bg-brand-expert/5">
          <div className="flex items-center gap-2 text-brand-expert mb-3">
            <Lightbulb className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">How to Make This</span>
            <span className="text-[10px] text-text-muted/60 normal-case tracking-normal">(directions, not copy-paste)</span>
          </div>
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-line">
            {day.directions}
          </p>
        </div>
      )}

      {/* On-Camera Script */}
      <div className="p-4 border-t border-background-secondary space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-accent-primary">
            <Video className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">On-Camera Script</span>
          </div>
          <CopyButton text={fullScript} label="Copy script" />
        </div>
        <div className="space-y-3">
          {/* Hook */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-wider text-accent-primary uppercase">Hook</span>
              <CopyButton text={day.hook} label="Copy hook" />
            </div>
            <p className="text-sm text-text-primary leading-relaxed font-medium">
              {day.hook}
            </p>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-wider text-text-muted uppercase">Body</span>
              <CopyButton text={day.body} label="Copy body" />
            </div>
            <p className="text-sm text-text-muted leading-relaxed whitespace-pre-line">
              {day.body}
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold tracking-wider text-brand-expert uppercase">Call to Action</span>
              <CopyButton text={day.cta} label="Copy CTA" />
            </div>
            <p className="text-sm text-brand-expert leading-relaxed font-medium">
              {day.cta}
            </p>
          </div>
        </div>
      </div>

      {/* Caption */}
      <div className="p-4 bg-background-secondary/30 border-t border-background-secondary space-y-3">
        <div className="flex items-center justify-between gap-2 text-text-muted">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Caption to Paste</span>
          </div>
          <CopyButton text={day.caption} label="Copy caption" />
        </div>
        <p className="text-xs text-text-muted leading-relaxed line-clamp-3">
          {day.caption}
        </p>
      </div>

      {/* Production Notes */}
      <div className="p-4 bg-background-secondary/30 border-t border-background-secondary space-y-3">
        <div className="flex items-center gap-2 text-accent-primary">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold tracking-wider uppercase">Production Notes</span>
        </div>
        <div className="space-y-2">
          {day.musicSuggestion && (
            <div className="flex items-start gap-1.5 text-xs text-text-muted">
              <Music className="h-3.5 w-3.5 text-accent-primary shrink-0 mt-0.5" />
              <span>{day.musicSuggestion}</span>
            </div>
          )}
          {day.duration && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock className="h-3.5 w-3.5 text-accent-primary shrink-0" />
              <span>{day.duration}</span>
            </div>
          )}
        </div>
      </div>

      {/* Best Time to Post */}
      <div className="p-4 bg-background-secondary/30 border-t border-background-secondary space-y-3">
        <div className="flex items-center gap-2 text-accent-primary">
          <Clock className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold tracking-wider uppercase">Best Time to Post</span>
        </div>
        <div className="space-y-2">
          {bestTimesByFormatAndDay[day.format][day.day as DayOfWeek].map((item: TimeSlot) => (
            <div key={item.platform} className="flex items-start justify-between gap-2 text-xs">
              <span className="text-text-primary font-medium">{item.platform}</span>
              <div className="text-right">
                <span className="text-text-muted">{item.time}</span>
                {item.note && (
                  <span className="block text-[10px] text-text-muted/60">{item.note}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Post To Platform Links */}
      {(() => {
        const eligiblePlatforms = FORMAT_PLATFORMS[day.format].filter((p) =>
          connectedPlatforms.includes(p)
        );
        if (eligiblePlatforms.length === 0) return null;
        return (
          <div className="p-4 bg-background-secondary/30 border-t border-background-secondary">
            <div className="flex items-center gap-2 text-accent-primary mb-3">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold tracking-wider uppercase">Post To</span>
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-br ${info.color} hover:opacity-90 transition-opacity`}
                  >
                    {info.label}
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Posted checkbox */}
      <div className="p-4 bg-background-secondary/30 border-t border-background-secondary">
        <label className={`flex items-center gap-3 cursor-pointer group/check ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="relative flex items-center">
            <input
              type="checkbox"
              checked={isPosted}
              onChange={onTogglePosted}
              disabled={isPending}
              className="peer h-5 w-5 rounded border border-background-secondary bg-background-card text-accent-primary focus:ring-accent-primary focus:ring-offset-0 focus:ring-offset-background-card transition-colors"
            />
          </div>
          <span className={`text-sm font-medium transition-colors ${isPosted ? "text-accent-primary" : "text-text-muted group-hover/check:text-text-primary"}`}>
            {isPending ? "Saving..." : isPosted ? "Posted / scheduled ✓" : "Mark as posted / scheduled"}
          </span>
        </label>
      </div>
    </div>
  );
}

export default function CalendarClient({ days, weekStarting, connectedPlatforms }: { days: CalendarDay[]; weekStarting: string; connectedPlatforms: string[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [posted, setPosted] = useState<boolean[]>(Array(days.length).fill(false));
  const [isPending, startTransition] = useTransition();
  const activeDay = days[activeIndex];

  const baseDate = new Date(weekStarting);
  const storageKey = `calendar-posted-${weekStarting}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === days.length) {
          setPosted(parsed);
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, [storageKey, days.length]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(posted));
    } catch {
      // ignore localStorage errors
    }
  }, [posted, storageKey]);

  const togglePosted = (index: number) => {
    const next = [...posted];
    next[index] = !next[index];
    setPosted(next);
    const willBePosted = next[index];
    startTransition(async () => {
      if (willBePosted) {
        await addToArchive(weekStarting, index, days[index]);
      } else {
        await removeFromArchive(weekStarting, index);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-background-secondary scrollbar-track-transparent">
        {days.map((day, index) => {
          const isActive = index === activeIndex;
          const isPosted = posted[index];
          const tabDate = new Date(baseDate);
          tabDate.setDate(baseDate.getDate() + index);
          const dateLabel = tabDate.toLocaleDateString("en-US", {
            weekday: "short",
            day: "numeric",
          });
          return (
            <button
              key={day.day}
              onClick={() => setActiveIndex(index)}
              className={`
                shrink-0 px-4 py-2 rounded-full text-xs font-bold tracking-wider uppercase
                transition-all duration-200 ease-out
                ${
                  isActive
                    ? "bg-[#c8952a] text-[#1a1a1a] shadow-lg shadow-[#c8952a]/20"
                    : "bg-[#2a2a2a] text-text-muted hover:text-text-primary hover:bg-[#333333]"
                }
                ${isPosted ? "line-through opacity-50" : ""}
              `}
            >
              {dateLabel}
            </button>
          );
        })}
      </div>

      {/* Focused Day Card */}
      <div className="transition-all duration-300 ease-in-out">
        <DayCard day={activeDay} isPosted={posted[activeIndex]} onTogglePosted={() => togglePosted(activeIndex)} isPending={isPending} connectedPlatforms={connectedPlatforms} />
      </div>
    </div>
  );
}
