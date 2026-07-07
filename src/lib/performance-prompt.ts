import {
  generateLifespanInsight,
  generateCadenceRecommendation,
  type ContentDecay,
  type PostingFrequency,
} from "@/lib/deep-analytics";

// ─── Shared types ──────────────────────────────────────────────────

export interface AnalyticsPostRow {
  title: string;
  format: string; // platform name (uppercase) as stored by sync
  views: number;
  likes: number;
  comments: number;
}

export interface ArchiveRow {
  title: string;
  format: string; // Reel | Carousel | Static
  bucket: string; // Personal | Expert | Local
  caption: string;
  hook: string;
}

export interface FeedbackRow {
  title: string;
  format: string;
  bucket: string;
  feedback: string; // "up" | "down"
}

export interface FollowerStatRow {
  platform: string;
  date: Date;
  followerCount: number;
  growthDelta: number;
}

function engagement(row: { likes: number; comments: number }): number {
  return row.likes + row.comments;
}

function engagementRate(row: AnalyticsPostRow): number {
  if (row.views <= 0) return 0;
  return (engagement(row) / row.views) * 100;
}

function platformLabel(p: string): string {
  const lower = p.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

// ─── Platform-level performance + top/bottom posts ─────────────────

export function buildPerformanceSignalsBlock(rows: AnalyticsPostRow[]): string {
  if (rows.length < 3) return "";

  // Per-platform aggregates
  const byPlatform = new Map<string, AnalyticsPostRow[]>();
  for (const row of rows) {
    const key = row.format.toLowerCase();
    const list = byPlatform.get(key) ?? [];
    list.push(row);
    byPlatform.set(key, list);
  }

  const platformLines: string[] = [];
  for (const [platform, posts] of byPlatform) {
    const avgViews = posts.reduce((s, p) => s + p.views, 0) / posts.length;
    const avgEng = posts.reduce((s, p) => s + engagement(p), 0) / posts.length;
    const withViews = posts.filter((p) => p.views > 0);
    const avgRate =
      withViews.length > 0
        ? withViews.reduce((s, p) => s + engagementRate(p), 0) / withViews.length
        : 0;
    platformLines.push(
      `- ${platformLabel(platform)}: ${posts.length} posts, avg ${fmt(avgViews)} views, avg ${fmt(avgEng)} interactions${avgRate > 0 ? `, ${avgRate.toFixed(1)}% engagement rate` : ""}`
    );
  }

  // Top and bottom performers by engagement
  const sorted = [...rows].sort((a, b) => engagement(b) - engagement(a));
  const top = sorted.slice(0, 5).filter((p) => engagement(p) > 0);
  const bottom = sorted.slice(-3).filter((p) => !top.includes(p));

  const topLines = top.map(
    (p) => `- "${p.title}" (${platformLabel(p.format)}: ${fmt(p.views)} views, ${fmt(engagement(p))} interactions)`
  );
  const bottomLines = bottom.map(
    (p) => `- "${p.title}" (${platformLabel(p.format)}: ${fmt(p.views)} views, ${fmt(engagement(p))} interactions)`
  );

  const sections: string[] = [
    `PLATFORM PERFORMANCE (last 90 days):\n${platformLines.join("\n")}`,
  ];
  if (topLines.length > 0) {
    sections.push(
      `TOP PERFORMERS: study these. Extract the hook patterns, topics, and angles that resonate with this audience and lean into MORE content like this (without repeating the exact posts):\n${topLines.join("\n")}`
    );
  }
  if (bottomLines.length > 0) {
    sections.push(
      `WEAKEST PERFORMERS: avoid repeating the patterns, topics, or angles of these posts:\n${bottomLines.join("\n")}`
    );
  }

  return `<performance_signals>\nReal analytics from this creator's connected accounts. Use these signals to bias topic and angle selection toward what demonstrably works for THIS audience.\n${sections.join("\n\n")}\n</performance_signals>`;
}

// ─── Bucket & format performance via archive ↔ analytics matching ──

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
}

export interface MatchedPost {
  bucket: string;
  format: string;
  views: number;
  likes: number;
  comments: number;
}

export function matchArchiveToAnalytics(
  archives: ArchiveRow[],
  analytics: AnalyticsPostRow[]
): MatchedPost[] {
  const matches: MatchedPost[] = [];
  for (const archive of archives) {
    const captionKey = normalizeForMatch(archive.caption);
    const hookKey = normalizeForMatch(archive.hook);
    if (!captionKey && !hookKey) continue;
    const hit = analytics.find((a) => {
      const titleKey = normalizeForMatch(a.title);
      if (!titleKey) return false;
      return (
        (captionKey.length >= 20 && (titleKey.startsWith(captionKey.slice(0, 40)) || captionKey.startsWith(titleKey.slice(0, 40)))) ||
        (hookKey.length >= 20 && (titleKey.startsWith(hookKey.slice(0, 40)) || hookKey.startsWith(titleKey.slice(0, 40))))
      );
    });
    if (hit) {
      matches.push({
        bucket: archive.bucket,
        format: archive.format,
        views: hit.views,
        likes: hit.likes,
        comments: hit.comments,
      });
    }
  }
  return matches;
}

export function buildContentPerformanceBlock(matches: MatchedPost[]): string {
  if (matches.length < 3) return "";

  const summarize = (key: "bucket" | "format"): string[] => {
    const groups = new Map<string, MatchedPost[]>();
    for (const m of matches) {
      const list = groups.get(m[key]) ?? [];
      list.push(m);
      groups.set(m[key], list);
    }
    const lines: string[] = [];
    for (const [label, posts] of groups) {
      const avgViews = posts.reduce((s, p) => s + p.views, 0) / posts.length;
      const avgEng = posts.reduce((s, p) => s + p.likes + p.comments, 0) / posts.length;
      lines.push(`- ${label}: ${posts.length} posts, avg ${fmt(avgViews)} views, avg ${fmt(avgEng)} interactions`);
    }
    return lines;
  };

  const bucketLines = summarize("bucket");
  const formatLines = summarize("format");

  return `<content_performance>\nPerformance of this creator's own published calendar content, broken down by bucket and format (${matches.length} matched posts). Weight the week's bucket and format mix toward what performs, while still respecting the minimum distribution rules.\nBY BUCKET:\n${bucketLines.join("\n")}\nBY FORMAT:\n${formatLines.join("\n")}\n</content_performance>`;
}

// ─── Follower growth trend ─────────────────────────────────────────

export function buildFollowerTrendBlock(rows: FollowerStatRow[]): string {
  if (rows.length === 0) return "";

  const byPlatform = new Map<string, FollowerStatRow[]>();
  for (const row of rows) {
    const key = row.platform.toLowerCase();
    const list = byPlatform.get(key) ?? [];
    list.push(row);
    byPlatform.set(key, list);
  }

  const lines: string[] = [];
  for (const [platform, stats] of byPlatform) {
    const sorted = [...stats].sort((a, b) => a.date.getTime() - b.date.getTime());
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last || last.followerCount <= 0) continue;
    const delta = last.followerCount - first.followerCount;
    const pct = first.followerCount > 0 ? (delta / first.followerCount) * 100 : 0;
    const trend = delta > 0 ? `+${fmt(delta)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)` : delta < 0 ? `${fmt(delta)} (${pct.toFixed(1)}%)` : "flat";
    lines.push(`- ${platformLabel(platform)}: ${fmt(last.followerCount)} followers, last 30 days: ${trend}`);
  }

  if (lines.length === 0) return "";
  return `<follower_trends>\nFollower growth over the last 30 days. Bias platform-native suggestions toward the fastest-growing channel, and consider community-consolidating content (welcome posts, audience Q&As) where growth is strong:\n${lines.join("\n")}\n</follower_trends>`;
}

// ─── Posting frequency & content decay ─────────────────────────────

export function buildCadenceBlock(
  postingFrequency: PostingFrequency | null,
  decayByPlatform: { platform: string; decay: ContentDecay }[],
  daysToPost: number
): string {
  const lines: string[] = [];

  if (postingFrequency && postingFrequency.rows.length > 0) {
    for (const row of postingFrequency.rows) {
      if (!row.platform || row.weeksCount <= 0) continue;
      lines.push(
        `- ${platformLabel(row.platform)}: historically posts ~${row.postsPerWeek.toFixed(1)}x/week with ${row.avgEngagementRate.toFixed(1)}% avg engagement rate (${row.weeksCount} weeks of data)`
      );
    }
  }

  for (const { platform, decay } of decayByPlatform) {
    const lifespan = generateLifespanInsight(decay.buckets, platform === "ALL" ? undefined : platform);
    if (lifespan) lines.push(`- ${lifespan}`);
    const cadence = generateCadenceRecommendation(decay.buckets);
    if (cadence && platform === "ALL") lines.push(`- ${cadence}`);
  }

  if (lines.length === 0) return "";
  return `<cadence_insights>\nHistorical posting cadence and content lifespan data. The user has chosen to post ${daysToPost} day(s) this week. Use these insights to decide how timely vs. evergreen each post should be, and mention cadence-relevant framing where useful:\n${lines.join("\n")}\n</cadence_insights>`;
}

// ─── User feedback (thumbs up/down on generated content) ──────────

export function buildFeedbackBlock(rows: FeedbackRow[]): string {
  if (rows.length === 0) return "";

  const loved = rows.filter((r) => r.feedback === "up");
  const rejected = rows.filter((r) => r.feedback === "down");

  const sections: string[] = [];
  if (loved.length > 0) {
    sections.push(
      `CONTENT THE USER LOVED: generate more ideas with similar angles, energy, and structure:\n${loved.map((r) => `- "${r.title}" (${r.format}, ${r.bucket})`).join("\n")}`
    );
  }
  if (rejected.length > 0) {
    sections.push(
      `CONTENT THE USER REJECTED: do NOT generate ideas with similar angles, topics, or framing:\n${rejected.map((r) => `- "${r.title}" (${r.format}, ${r.bucket})`).join("\n")}`
    );
  }

  return `<user_feedback>\nDirect thumbs up/down feedback from the user on previously generated content ideas. This is the strongest signal of their taste, treat it as authoritative.\n${sections.join("\n\n")}\n</user_feedback>`;
}
