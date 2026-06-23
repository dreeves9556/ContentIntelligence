"use client";

import { useState } from "react";

// ─── Platform data ────────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    gradient: "from-[#833ab4] via-[#fd1d1d] to-[#fcb045]",
    algorithmFocus: "Prioritizes DM Shares",
    logo: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-label="Instagram">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad)" />
        <defs>
          <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fcb045" />
            <stop offset="50%" stopColor="#fd1d1d" />
            <stop offset="100%" stopColor="#833ab4" />
          </linearGradient>
        </defs>
      </svg>
    ),
    practices: [
      "Use Carousels for highest engagement — they generate the most swipes and saves",
      "Hook viewers in the first 3 seconds or they scroll past",
      "Original content only — reposts get suppressed by the algorithm",
    ],
    tip: "Saves = reach multiplier. Always give them a reason to save.",
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    gradient: "from-[#1877F2] to-[#0d5bbf]",
    algorithmFocus: "Rewards First-60-Minute Engagement",
    logo: (
      <svg viewBox="0 0 24 24" fill="#1877F2" className="h-8 w-8" aria-label="Facebook">
        <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
    practices: [
      "Capitalize on the first 60 minutes — early engagement signals viral potential",
      "Never put external links in the caption; drop them in the first comment",
      "Utilize Facebook Groups to build community and bypass the feed algorithm",
    ],
    tip: "Comments in the first hour matter more than any post-day engagement.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#010101",
    gradient: "from-[#010101] to-[#161616]",
    algorithmFocus: "Optimizes for Rewatchability",
    logo: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-label="TikTok">
        <path
          d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"
          fill="white"
        />
        <path
          d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"
          fill="#69C9D0"
          opacity="0.5"
          style={{ transform: "translate(1px, 0)" }}
        />
        <path
          d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"
          fill="#EE1D52"
          opacity="0.5"
          style={{ transform: "translate(-1px, 0)" }}
        />
      </svg>
    ),
    practices: [
      "Optimize for Search (SEO) — use keywords in your captions and spoken words",
      "Aim for 60–180 second videos; they're the sweet spot for watch time",
      "Prioritize rewatchability — design loops and payoffs that earn replays",
    ],
    tip: "TikTok is a search engine. Caption your niche keywords like you mean it.",
  },
];

// ─── Format data ──────────────────────────────────────────────────────────────

const FORMATS = [
  {
    id: "short-form",
    name: "Short-Form Video",
    emoji: "🎬",
    tagline: "Win attention in under 60 seconds",
    accentColor: "accent-primary",
    steps: [
      {
        number: "01",
        label: "The Hook",
        duration: "0 – 3s",
        description: "Stop the scroll with a bold claim, shocking visual, or pattern interrupt. This is everything.",
        badge: "Critical",
        badgeColor: "bg-red-500/15 text-red-400 border-red-500/20",
      },
      {
        number: "02",
        label: "The Retention Body",
        duration: "3 – 45s",
        description: "Deliver value in short punchy beats. Use text overlays, jump cuts, and B-roll to maintain pace.",
        badge: "Substance",
        badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      },
      {
        number: "03",
        label: "The Loop Bait",
        duration: "~45s",
        description: "Tease something earlier in the video — 'as I mentioned at the start…' — to trigger a rewatch.",
        badge: "Retention",
        badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      },
      {
        number: "04",
        label: "The Micro-CTA",
        duration: "Final 3s",
        description: "One action only. Save, share, follow, or comment. Multiple CTAs kill conversion.",
        badge: "Action",
        badgeColor: "bg-green-500/15 text-green-400 border-green-500/20",
      },
    ],
  },
  {
    id: "carousels",
    name: "Carousels",
    emoji: "🗂️",
    tagline: "The highest-save format on Instagram",
    accentColor: "accent-primary",
    steps: [
      {
        number: "01",
        label: "Slide 1 — The Promise",
        duration: "Cover",
        description: "Your title slide must answer: 'Why should I swipe?' Bold headline, clean design, clear value prop.",
        badge: "Must Swipe",
        badgeColor: "bg-red-500/15 text-red-400 border-red-500/20",
      },
      {
        number: "02",
        label: "Slides 2–6 — The Meat",
        duration: "Core",
        description: "One idea per slide. Use the 'breadcrumb' technique — each slide teases the next to keep swiping.",
        badge: "Value",
        badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      },
      {
        number: "03",
        label: "Slide 7–8 — The Plot Twist",
        duration: "Peak",
        description: "Drop your most surprising or counter-intuitive point here. This is what gets shared.",
        badge: "Shareability",
        badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      },
      {
        number: "04",
        label: "Last Slide — The Save Hook",
        duration: "Final",
        description: "End with a summary slide or 'save this for later' prompt. Saves are the #1 reach signal.",
        badge: "Save Trigger",
        badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCard({ platform }: { platform: (typeof PLATFORMS)[number] }) {
  return (
    <div className="bg-background-card rounded-2xl border border-background-secondary overflow-hidden hover:border-accent-primary/30 transition-all duration-300 group flex flex-col">
      {/* Top accent bar */}
      <div className={`h-1 w-full bg-gradient-to-r ${platform.gradient}`} />

      <div className="p-6 flex flex-col flex-1 gap-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-background-secondary">
            {platform.logo}
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">{platform.name}</h3>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${platform.gradient} text-white mt-0.5`}
            >
              ⚡ {platform.algorithmFocus}
            </span>
          </div>
        </div>

        {/* Best Practices */}
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Best Practices</p>
          <ul className="space-y-2.5">
            {platform.practices.map((practice, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-muted leading-snug">
                <span
                  className={`mt-0.5 shrink-0 w-4 h-4 rounded-full bg-gradient-to-br ${platform.gradient} flex items-center justify-center text-[9px] font-bold text-white`}
                >
                  {i + 1}
                </span>
                {practice}
              </li>
            ))}
          </ul>
        </div>

        {/* Pro tip */}
        <div className="mt-auto pt-4 border-t border-background-secondary">
          <p className="text-xs text-text-muted italic">
            <span className="not-italic font-semibold text-text-primary">Pro tip: </span>
            {platform.tip}
          </p>
        </div>
      </div>
    </div>
  );
}

function FormatCard({ format }: { format: (typeof FORMATS)[number] }) {
  return (
    <div className="bg-background-card rounded-2xl border border-background-secondary overflow-hidden hover:border-accent-primary/30 transition-all duration-300 flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-background-secondary">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl" role="img" aria-label={format.name}>
            {format.emoji}
          </span>
          <div>
            <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: "var(--font-playfair)" }}>
              {format.name}
            </h3>
            <p className="text-xs text-text-muted">{format.tagline}</p>
          </div>
        </div>
      </div>

      {/* Timeline steps */}
      <div className="p-6 flex flex-col gap-0">
        {format.steps.map((step, i) => (
          <div key={step.number} className="flex gap-4">
            {/* Connector column */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-9 h-9 rounded-full bg-accent-primary/10 border-2 border-accent-primary/30 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-bold text-accent-primary">{step.number}</span>
              </div>
              {i < format.steps.length - 1 && (
                <div className="w-px flex-1 min-h-[24px] bg-gradient-to-b from-accent-primary/30 to-transparent mt-1 mb-1" />
              )}
            </div>

            {/* Content */}
            <div className={`pb-${i < format.steps.length - 1 ? "5" : "0"} flex-1 min-w-0`} style={{ paddingBottom: i < format.steps.length - 1 ? "20px" : "0" }}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-semibold text-sm text-text-primary">{step.label}</span>
                <span className="text-[10px] text-text-muted bg-background-secondary px-1.5 py-0.5 rounded">
                  {step.duration}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${step.badgeColor}`}
                >
                  {step.badge}
                </span>
              </div>
              <p className="text-sm text-text-muted leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Section = "playbooks" | "formats";

export default function Social101Tab() {
  const [section, setSection] = useState<Section>("playbooks");

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-accent-primary/20 via-accent-primary/5 to-transparent border border-accent-primary/20 px-6 py-8">
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-accent-primary/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">📡</span>
            <span className="text-xs font-bold uppercase tracking-widest text-accent-primary">Social 101</span>
          </div>
          <h2
            className="text-2xl font-bold text-text-primary mb-1"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            Master the platforms. Own the algorithm.
          </h2>
          <p className="text-text-muted text-sm max-w-xl">
            Tactical playbooks for each platform and visual frameworks for every format — so you stop guessing and start growing.
          </p>
        </div>
      </div>

      {/* Section toggle */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-background-secondary rounded-xl w-full sm:w-fit">
        <button
          onClick={() => setSection("playbooks")}
          className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
            section === "playbooks"
              ? "bg-background-card text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          🗺️ Platform Playbooks
        </button>
        <button
          onClick={() => setSection("formats")}
          className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
            section === "formats"
              ? "bg-background-card text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          🎓 Format Masterclasses
        </button>
      </div>

      {/* Platform Playbooks */}
      {section === "playbooks" && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Platform Playbooks
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              How each algorithm actually works — and how to play it to win.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PLATFORMS.map((platform) => (
              <PlatformCard key={platform.id} platform={platform} />
            ))}
          </div>
        </div>
      )}

      {/* Format Masterclasses */}
      {section === "formats" && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Format Masterclasses
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              Step-by-step frameworks for the formats that move the needle.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {FORMATS.map((format) => (
              <FormatCard key={format.id} format={format} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
