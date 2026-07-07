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
    cadence: "1 image + up to 4 Reels/day",
    contentMix: "40% Reels · 40% Carousels · 20% Images",
    practices: [
      "DM shares are the #1 ranking signal in 2026 — weighted 3–5x more than likes. Create content people send to friends",
      "Reels win raw reach (3–5x more non-followers); Carousels win saves (3–4x save rate). Use Reels to grow, Carousels to convert",
      "Hashtags are declining — posts with hashtags see 32% fewer views. Use 3–5 niche tags max, or skip entirely and write natural-language captions",
      "Original content only — the Aggregator Penalty suppresses reposts and watermarked TikToks. Re-edit before cross-posting",
      "End captions with a question — posts with comment-focused CTAs generate 203% more comments",
      "Carousel completion rate matters: the algorithm tracks whether viewers swipe through all slides. Put your best slide mid-carousel, not first",
    ],
    tip: "Sends > Saves > Comments > Likes. A DM share is worth 5 likes to the algorithm.",
    keyStats: [
      { value: "5x", label: "DM share weight vs likes" },
      { value: "32%", label: "fewer views with hashtags" },
      { value: "203%", label: "more comments with Q-CTAs" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    gradient: "from-[#1877F2] to-[#0d5bbf]",
    algorithmFocus: "Rewards First-60-Minute Engagement",
    cadence: "1–2 posts/day",
    contentMix: "Native video · Groups · Live · Discussion posts",
    logo: (
      <svg viewBox="0 0 24 24" fill="#1877F2" className="h-8 w-8" aria-label="Facebook">
        <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
    practices: [
      "Capitalize on the first 60 minutes — early engagement signals viral potential to the algorithm",
      "Never put external links in the caption; drop them in the first comment. Links in posts get suppressed",
      "Utilize Facebook Groups to build community and bypass the feed algorithm — Groups content gets priority distribution",
      "Native video outperforms shared links 3-to-1. Upload videos directly to Facebook rather than sharing YouTube links",
      "Go Live regularly — Facebook pushes Live content to notifications and gives it priority feed placement",
    ],
    tip: "Comments in the first hour matter more than any post-day engagement. Reply to every comment quickly.",
    keyStats: [
      { value: "60min", label: "golden window for engagement" },
      { value: "3:1", label: "native video vs shared links" },
      { value: "Priority", label: "Live feed placement boost" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#010101",
    gradient: "from-[#010101] to-[#161616]",
    algorithmFocus: "Optimizes for Search & Rewatchability",
    cadence: "1–4 videos/day",
    contentMix: "60–180s videos · trend participation · SEO-optimized captions",
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
      "TikTok is a search engine — use keywords in captions, spoken words, and on-screen text. Say your target keyword in the first 3 seconds",
      "Aim for 60–180 second videos. The algorithm rewards watch time and completion rate, not just views",
      "Jump on trends within 48–72 hours. Late participation gets minimal distribution",
      "Authentic, slightly imperfect content outperforms polished videos. The algorithm flags overly produced content",
      "Design loops — tease something from the start at the end to trigger rewatches. Rewatch rate feeds the For You Page",
      "Use TikTok's Creator Search Insights to find what your audience is searching for, then make content matching those queries",
    ],
    tip: "TikTok auto-generates captions from spoken words. Say your keywords out loud — they become searchable text.",
    keyStats: [
      { value: "3s", label: "say keywords in first 3 sec" },
      { value: "60-180s", label: "sweet spot video length" },
      { value: "48-72h", label: "trend participation window" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    color: "#0A66C2",
    gradient: "from-[#0A66C2] to-[#004182]",
    algorithmFocus: "Rewards Topic Authority & Dwell Time",
    cadence: "2–4 posts/week + 5 comments/day",
    contentMix: "Text posts · Document carousels · Short video (<90s)",
    logo: (
      <svg viewBox="0 0 24 24" fill="#0A66C2" className="h-8 w-8" aria-label="LinkedIn">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    practices: [
      "Define 2–3 core content pillars and stay within them 80% of the time. The algorithm classifies you by topic consistency — 'Topic Authority' drives distribution",
      "Document carousels (PDF posts) get 6.6% engagement vs 2% for text. Use them for frameworks, checklists, and step-by-step guides",
      "The first 60 minutes are the 'golden hour' — early comments and reactions determine whether your post gets expanded or killed",
      "Never put external links in the post body — they reduce reach by ~60%. Drop links in the first comment",
      "Comment on 5 posts in your niche daily before posting. Comments drive more profile views than your own posts",
      "Write 1,300+ character text posts with a strong hook (first 1–3 lines), short paragraphs, and an open-ended question. Avoid 'Thoughts?' — the algorithm penalizes it",
    ],
    tip: "Comments on other people's posts drive more profile views than your own posts. Engage first, post second.",
    keyStats: [
      { value: "6.6%", label: "document carousel engagement" },
      { value: "60%", label: "reach loss from external links" },
      { value: "1,300+", label: "characters for text posts" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    color: "#FF0000",
    gradient: "from-[#FF0000] to-[#CC0000]",
    algorithmFocus: "Shorts for Discovery · Long-form for Authority",
    cadence: "1–2 long-form/week + 3–5 Shorts/week",
    contentMix: "25–40% Shorts · 60–75% long-form (15–25 min)",
    logo: (
      <svg viewBox="0 0 24 24" fill="#FF0000" className="h-8 w-8" aria-label="YouTube">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
    practices: [
      "Use the hub-and-spoke model: Shorts are your discovery engine, long-form is your conversion engine. You need both",
      "Keep Shorts at 25–40% of uploads. Above 55%, long-form audience engagement starts to thin",
      "Build each Short as an entry point, not a standalone — show the result, withhold the method. Point viewers to long-form for the full answer",
      "Custom thumbnails and the first 30 seconds matter more than the rest of the video combined",
      "YouTube is the second largest search engine — optimize titles and descriptions for SEO. Long-form videos rank in Google search and compound for years",
      "Configure the Related Video field on every Short and add a verbal CTA in the final 3 seconds to bridge Shorts viewers to long-form",
    ],
    tip: "Two deeply-researched long-form videos per month beats daily uploads of weak content.",
    keyStats: [
      { value: "25-40%", label: "Shorts upload sweet spot" },
      { value: "30s", label: "first seconds matter most" },
      { value: "3-5", label: "Shorts per long-form video" },
    ],
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
  {
    id: "linkedin-text",
    name: "LinkedIn Text Posts",
    emoji: "✍️",
    tagline: "1,300+ characters that the algorithm loves",
    accentColor: "accent-primary",
    steps: [
      {
        number: "01",
        label: "The Hook (Lines 1–3)",
        duration: "First 1–3 lines",
        description: "The mobile feed truncates after 1–3 lines. Write a hook that creates curiosity, states a counterintuitive truth, or signals high value. This determines if anyone clicks 'see more'.",
        badge: "Critical",
        badgeColor: "bg-red-500/15 text-red-400 border-red-500/20",
      },
      {
        number: "02",
        label: "The Story Setup",
        duration: "Lines 4–10",
        description: "Open with a specific, personal anecdote. Name the situation, the stakes, and what went wrong. Specificity signals authenticity — the algorithm now detects and penalizes generic templated content.",
        badge: "Authenticity",
        badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      },
      {
        number: "03",
        label: "The Lessons (1-2-1 Format)",
        duration: "Body",
        description: "Share one story, two actionable lessons, and one question. Each lesson should be a framework, checklist, or specific takeaway the reader can apply immediately.",
        badge: "Value",
        badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      },
      {
        number: "04",
        label: "The Open-Ended CTA",
        duration: "Final line",
        description: "End with a specific, answerable question — never 'Thoughts?' (the algorithm penalizes it). Ask something that requires a 10+ word reply. Meaningful comments are a top ranking signal.",
        badge: "Engagement",
        badgeColor: "bg-green-500/15 text-green-400 border-green-500/20",
      },
    ],
  },
  {
    id: "youtube-hub-spoke",
    name: "YouTube Hub & Spoke",
    emoji: "🎥",
    tagline: "Shorts discover, long-form converts",
    accentColor: "accent-primary",
    steps: [
      {
        number: "01",
        label: "Pick Your Long-Form Topic",
        duration: "Planning",
        description: "Choose a search-driven topic with proven demand. Check YouTube search autocomplete and Google Trends. Long-form videos rank in YouTube and Google search for years — this is your compounding asset.",
        badge: "Strategy",
        badgeColor: "bg-blue-500/15 text-blue-400 border-blue-500/20",
      },
      {
        number: "02",
        label: "Extract 3–5 Shorts",
        duration: "Production",
        description: "From each long-form video, extract 3–5 standalone Shorts. Each Short should show the result but withhold the method — an incomplete answer that only the long-form video closes.",
        badge: "Repurpose",
        badgeColor: "bg-purple-500/15 text-purple-400 border-purple-500/20",
      },
      {
        number: "03",
        label: "Bridge Every Short",
        duration: "Upload",
        description: "Configure the Related Video field on every Short. Add a verbal CTA in the final 3 seconds: 'I break this down step-by-step in the full video — link is below.' This bridges Shorts viewers to your long-form catalog.",
        badge: "Critical",
        badgeColor: "bg-red-500/15 text-red-400 border-red-500/20",
      },
      {
        number: "04",
        label: "Thumbnail + First 30s",
        duration: "Long-form",
        description: "Design a custom thumbnail that creates curiosity gap. Script the first 30 seconds like a Short — hook, promise, pattern interrupt. The first 30 seconds matter more than the rest of the video combined.",
        badge: "Retention",
        badgeColor: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      },
    ],
  },
];

const AUTO_DM_WORKFLOWS = [
  {
    id: "instagram",
    name: "Instagram",
    gradient: "from-[#833ab4] via-[#fd1d1d] to-[#fcb045]",
    logo: (
      <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-label="Instagram">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" stroke="url(#ig-grad-autodm)" strokeWidth="2" />
        <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad-autodm)" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-grad-autodm)" />
        <defs>
          <linearGradient id="ig-grad-autodm" x1="2" y1="22" x2="22" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fcb045" />
            <stop offset="50%" stopColor="#fd1d1d" />
            <stop offset="100%" stopColor="#833ab4" />
          </linearGradient>
        </defs>
      </svg>
    ),
    summary: "Turn comments into leads with Instagram's native automated responses or Meta Business Suite.",
    steps: [
      "Open Instagram → Professional dashboard → Automated responses.",
      "Choose 'Comment to DM' or 'FAQ' (availability varies by region/account).",
      "Set a trigger word like 'GUIDE', 'DM', or 'LINK'.",
      "Write the DM you want to send automatically.",
      "Turn it on and test it from a secondary account.",
    ],
    fallback: "If the native option isn't available, connect Meta Business Suite Automations or use ManyChat.",
  },
  {
    id: "facebook",
    name: "Facebook",
    gradient: "from-[#1877F2] to-[#0d5bbf]",
    logo: (
      <svg viewBox="0 0 24 24" fill="#1877F2" className="h-8 w-8" aria-label="Facebook">
        <path d="M22 12C22 6.477 17.523 2 12 2S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
      </svg>
    ),
    summary: "Use Meta Business Suite to automatically DM anyone who comments a trigger word on a post.",
    steps: [
      "Go to business.facebook.com and open your Page Inbox.",
      "Click 'Automations' in the left sidebar.",
      "Create a rule: 'When someone comments on a post' + your keyword.",
      "Set the action to 'Send a message in Messenger'.",
      "Write the message, save it, and test on a real post.",
    ],
    fallback: "For advanced flows, connect ManyChat or a similar Messenger automation tool.",
  },
  {
    id: "tiktok",
    name: "TikTok",
    gradient: "from-[#010101] to-[#161616]",
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
    summary: "TikTok auto-DMs are limited; use native Auto Message or a third-party automation tool.",
    steps: [
      "Switch to a TikTok Business account.",
      "Open TikTok → Business Suite → Auto Message (if available in your region).",
      "Create a keyword trigger and the reply message.",
      "Connect a lead CRM or automation tool like ManyChat for advanced flows.",
      "Test the workflow before posting publicly.",
    ],
    fallback: "TikTok's native automation is rolling out gradually; use ManyChat or a similar tool as a backup.",
  },
];

// ─── Growth Fundamentals data ─────────────────────────────────────────────────

const GROWTH_PRINCIPLES = [
  {
    icon: "🎯",
    title: "Pick 3 Platforms: Hub, Spoke, Search",
    description: "Don't be everywhere. Choose one hub (newsletter or website), one spoke (TikTok, Reels, or Shorts for discovery), and one search (YouTube long-form or blog for compounding SEO). Most creators fail by spreading too thin.",
  },
  {
    icon: "🔍",
    title: "Social Platforms Are Search Engines Now",
    description: "TikTok, Instagram, LinkedIn, and YouTube all use search-based discovery. Keywords in captions, spoken words, and on-screen text directly feed the algorithm. Write captions like SEO metadata.",
  },
  {
    icon: "🤝",
    title: "Communities > Followers",
    description: "Vanity metrics are dead. 500 engaged community members who DM your content to friends beat 50K passive followers. The algorithms now weight shares, saves, and meaningful comments far above likes.",
  },
  {
    icon: "🧠",
    title: "AI Search Is Indexing Your Content",
    description: "ChatGPT, Perplexity, and Google AI Overviews pull from social posts. Your LinkedIn content, podcast appearances, and published articles all feed AI citation. Being cited across multiple sources builds authority signals AI systems reward.",
  },
  {
    icon: "♻️",
    title: "Repurpose 1 → 10",
    description: "One pillar piece (long-form video or article) becomes 10–15 platform-specific assets. A YouTube video becomes 5 Shorts, a LinkedIn carousel, an Instagram Reel, a newsletter section, and 3 text posts.",
  },
  {
    icon: "⏱️",
    title: "Expect 60–90 Days for Traction",
    description: "TikTok and Reels can hit early viral moments in 2–4 weeks. LinkedIn and YouTube long-form realistically take 6–12 months. Consistency compounds — the algorithm rewards accounts that show up daily.",
  },
];

const CADENCE_REFERENCE = [
  { platform: "Instagram", cadence: "1 image + up to 4 Reels/day", best: "6–9 PM weekdays, 11 AM–1 PM weekends" },
  { platform: "TikTok", cadence: "1–4 videos/day", best: "Post when audience is active — no universal best time" },
  { platform: "LinkedIn", cadence: "2–4 posts/week", best: "7–9 AM local, then repost/comment-bump at 5–6 PM" },
  { platform: "YouTube", cadence: "1–2 long-form/wk + 3–5 Shorts/wk", best: "Watch time matters more than posting time" },
  { platform: "Facebook", cadence: "1–2 posts/day", best: "Weekdays, early afternoon" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlatformCard({ platform }: { platform: (typeof PLATFORMS)[number] }) {
  return (
    <div className="bg-background-card rounded-2xl border border-border-primary overflow-hidden hover:border-accent-primary/30 transition-all duration-300 group flex flex-col">
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

        {/* Cadence + Content Mix */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background-secondary/50 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Cadence</p>
            <p className="text-xs text-text-primary font-medium">{platform.cadence}</p>
          </div>
          <div className="bg-background-secondary/50 rounded-lg px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-0.5">Content Mix</p>
            <p className="text-xs text-text-primary font-medium">{platform.contentMix}</p>
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
        <div className="mt-auto pt-4 border-t border-border-primary">
          <p className="text-xs text-text-muted italic">
            <span className="not-italic font-semibold text-text-primary">Pro tip: </span>
            {platform.tip}
          </p>
        </div>
      </div>
    </div>
  );
}

function getPracticeTag(text: string): { tag: string; color: string } {
  const l = text.toLowerCase();
  if (l.includes("search") || l.includes("keyword") || l.includes("seo")) return { tag: "SEO", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" };
  if (l.includes("reel") || l.includes("carousel") || l.includes("video") || l.includes("short") || l.includes("thumbnail") || l.includes("document")) return { tag: "Format", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" };
  if (l.includes("comment") || l.includes("engage") || l.includes("question") || l.includes("cta")) return { tag: "Engagement", color: "bg-green-500/15 text-green-400 border-green-500/20" };
  if (l.includes("signal") || l.includes("algorithm") || l.includes("penalty") || l.includes("suppress") || l.includes("original") || l.includes("aggregator")) return { tag: "Signal", color: "bg-purple-500/15 text-purple-400 border-purple-500/20" };
  if (l.includes("trend") || l.includes("hub") || l.includes("group") || l.includes("live") || l.includes("pillar") || l.includes("entry point")) return { tag: "Strategy", color: "bg-amber-500/15 text-amber-400 border-amber-500/20" };
  if (l.includes("loop") || l.includes("rewatch") || l.includes("retention") || l.includes("watch") || l.includes("swipe") || l.includes("completion") || l.includes("first 30")) return { tag: "Retention", color: "bg-red-500/15 text-red-400 border-red-500/20" };
  return { tag: "Tip", color: "bg-gray-500/15 text-gray-400 border-gray-500/20" };
}

function PlatformDetail({ platform }: { platform: (typeof PLATFORMS)[number] }) {
  return (
    <div className="space-y-6">
      {/* Hero banner with platform gradient */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${platform.gradient} px-6 py-8`}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm shrink-0">
            {platform.logo}
          </div>
          <div className="text-white">
            <h3 className="text-2xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
              {platform.name}
            </h3>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm mt-1">
              ⚡ {platform.algorithmFocus}
            </span>
          </div>
        </div>
      </div>

      {/* Key stat callouts */}
      <div className="grid grid-cols-3 gap-3">
        {platform.keyStats.map((stat, i) => (
          <div
            key={i}
            className="bg-background-card rounded-xl border border-border-primary p-4 text-center hover:border-accent-primary/30 transition-colors"
          >
            <p className="text-xl sm:text-2xl font-bold text-text-primary">
              {stat.value}
            </p>
            <p className="text-[11px] font-medium text-text-muted mt-1 leading-tight">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Cadence + Content Mix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-background-card rounded-xl border border-border-primary p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" style={{ color: platform.color }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Cadence</p>
            <p className="text-sm text-text-primary font-semibold">{platform.cadence}</p>
          </div>
        </div>
        <div className="bg-background-card rounded-xl border border-border-primary p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2" style={{ color: platform.color }}>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Content Mix</p>
            <p className="text-sm text-text-primary font-semibold">{platform.contentMix}</p>
          </div>
        </div>
      </div>

      {/* Best Practices — card grid with category tags */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Best Practices</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {platform.practices.map((practice, i) => {
            const { tag, color } = getPracticeTag(practice);
            return (
              <div
                key={i}
                className="bg-background-card rounded-xl border border-border-primary p-4 hover:border-accent-primary/30 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl font-bold text-text-muted/30 shrink-0 leading-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mb-2 ${color}`}>
                      {tag}
                    </span>
                    <p className="text-[15px] text-text-primary/90 leading-relaxed">{practice}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pro tip callout */}
      <div className="bg-background-card rounded-2xl border border-border-primary px-6 py-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0">💡</span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-text-muted mb-1">Pro Tip</p>
            <p className="text-[15px] text-text-primary/90 font-medium leading-relaxed">{platform.tip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormatCard({ format }: { format: (typeof FORMATS)[number] }) {
  return (
    <div className="bg-background-card rounded-2xl border border-border-primary overflow-hidden hover:border-accent-primary/30 transition-all duration-300 flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-border-primary">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl" role="img" aria-label={format.name}>
            {format.emoji}
          </span>
          <div>
            <h3 className="text-xl font-bold text-text-primary" style={{ fontFamily: "var(--font-serif)" }}>
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

function AutoDmCard({ workflow }: { workflow: (typeof AUTO_DM_WORKFLOWS)[number] }) {
  return (
    <div className="bg-background-card rounded-2xl border border-border-primary overflow-hidden hover:border-accent-primary/30 transition-all duration-300 group flex flex-col">
      <div className={`h-1 w-full bg-gradient-to-r ${workflow.gradient}`} />
      <div className="p-6 flex flex-col flex-1 gap-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-background-secondary">
            {workflow.logo}
          </div>
          <div>
            <h3 className="text-lg font-bold text-text-primary">{workflow.name}</h3>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-gradient-to-r ${workflow.gradient} text-white mt-0.5`}
            >
              ⚡ Auto DM
            </span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-text-muted leading-snug">{workflow.summary}</p>
          <ul className="space-y-2.5 mt-4">
            {workflow.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-text-muted leading-snug">
                <span
                  className={`mt-0.5 shrink-0 w-4 h-4 rounded-full bg-gradient-to-br ${workflow.gradient} flex items-center justify-center text-[9px] font-bold text-white`}
                >
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto pt-4 border-t border-border-primary">
          <p className="text-xs text-text-muted italic">
            <span className="not-italic font-semibold text-text-primary">Fallback: </span>
            {workflow.fallback}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

type Section = "fundamentals" | "playbooks" | "formats" | "automations";

export default function Social101Tab() {
  const [section, setSection] = useState<Section>("playbooks");
  const [activePlatform, setActivePlatform] = useState<string>("instagram");

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
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Master the platforms. Own the algorithm.
          </h2>
          <p className="text-text-muted text-sm max-w-xl">
            Tactical playbooks, visual frameworks, and automation workflows — so you stop guessing and start growing.
          </p>
        </div>
      </div>

      {/* Section toggle */}
      <div className="sticky top-12 z-10 flex flex-wrap items-center gap-1 p-1 bg-background-secondary rounded-xl w-full sm:w-fit shadow-sm">
        <button
          onClick={() => setSection("fundamentals")}
          className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
            section === "fundamentals"
              ? "bg-background-card text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          📊 Growth Fundamentals
        </button>
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
        <button
          onClick={() => setSection("automations")}
          className={`flex-1 sm:flex-none px-3 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
            section === "automations"
              ? "bg-background-card text-text-primary shadow-sm"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          🤖 Auto DM Workflows
        </button>
      </div>

      {/* Growth Fundamentals */}
      {section === "fundamentals" && (
        <div className="space-y-6">
          <div>
            <h3
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Growth Fundamentals
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              The core principles that drive growth across every platform in 2026.
            </p>
          </div>

          {/* Principles grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {GROWTH_PRINCIPLES.map((p, i) => (
              <div
                key={i}
                className="bg-background-card rounded-2xl border border-border-primary p-6 hover:border-accent-primary/30 transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0" role="img" aria-label={p.title}>
                    {p.icon}
                  </span>
                  <div>
                    <h4 className="font-bold text-text-primary text-sm mb-1.5">{p.title}</h4>
                    <p className="text-sm text-text-muted leading-relaxed">{p.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Cadence reference table */}
          <div className="bg-background-card rounded-2xl border border-border-primary overflow-hidden">
            <div className="p-6 pb-4 border-b border-border-primary">
              <h4
                className="text-lg font-bold text-text-primary"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Posting Cadence Reference
              </h4>
              <p className="text-xs text-text-muted mt-0.5">
                Recommended posting frequency and best times by platform.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary">
                    <th className="text-left font-bold text-[10px] uppercase tracking-widest text-text-muted px-6 py-3">Platform</th>
                    <th className="text-left font-bold text-[10px] uppercase tracking-widest text-text-muted px-6 py-3">Cadence</th>
                    <th className="text-left font-bold text-[10px] uppercase tracking-widest text-text-muted px-6 py-3">Best Times</th>
                  </tr>
                </thead>
                <tbody>
                  {CADENCE_REFERENCE.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-border-primary last:border-0 hover:bg-background-secondary/30 transition-colors"
                    >
                      <td className="px-6 py-3 font-semibold text-text-primary">{row.platform}</td>
                      <td className="px-6 py-3 text-text-muted">{row.cadence}</td>
                      <td className="px-6 py-3 text-text-muted">{row.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Platform Playbooks */}
      {section === "playbooks" && (
        <div className="space-y-5">
          {/* Platform tab bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
            {PLATFORMS.map((p) => {
              const isActive = activePlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePlatform(p.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-background-card text-text-primary border-2"
                      : "bg-background-card text-text-muted hover:text-text-primary border border-border-primary"
                  }`}
                  style={isActive ? { borderColor: p.color } : undefined}
                >
                  <div className={`flex items-center justify-center w-8 h-8 rounded-md ${isActive ? "bg-background-secondary" : "bg-background-secondary"}`}>
                    {p.logo}
                  </div>
                  {p.name}
                </button>
              );
            })}
          </div>

          {/* Active platform detail */}
          {PLATFORMS.map((platform) =>
            platform.id === activePlatform ? (
              <PlatformDetail key={platform.id} platform={platform} />
            ) : null
          )}
        </div>
      )}

      {/* Format Masterclasses */}
      {section === "formats" && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
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

      {section === "automations" && (
        <div className="space-y-4">
          <div>
            <h3
              className="text-xl font-bold text-text-primary"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Auto DM Workflows
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              Turn commenters into leads by sending a DM when they say a trigger word.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {AUTO_DM_WORKFLOWS.map((workflow) => (
              <AutoDmCard key={workflow.id} workflow={workflow} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
