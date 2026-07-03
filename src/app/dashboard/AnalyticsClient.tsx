"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  Users,
  Eye,
  Heart,
  FileText,
  Sparkles,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Music2,
  Share2,
  BarChart2,
  PlayCircle,
  MonitorPlay,
  Loader2,
  Database,
  Layers,
  Clock,
  UserPlus,
  Timer,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { seedPostAnalytics, getCachedInsight } from "./actions";
import SyncButton from "./integrations/SyncButton";
import {
  DAY_LABELS_SHORT,
  formatHour,
  formatHourShort,
  bestSlotForDay,
  heatmapToLocalTime,
  getTimezoneOffsetHours,
  getTimezoneLabel,
  type HeatmapData,
} from "@/lib/best-time";
import { generateLifespanInsight, generateCadenceRecommendation, type ContentDecayBucket } from "@/lib/deep-analytics";

function ConditionalLink({ href, className, children }: { href: string | null; className?: string; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

function buildTrendData(posts: PostData[]) {
  const now = new Date();
  const weeks: { week: string; dateRange: string; views: number; engagement: number }[] = [];
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7 - 6);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() - i * 7);
    const label = `Wk ${8 - i}`;
    const dateRange = `${fmt(weekStart)} – ${fmt(weekEnd)}`;
    const weekPosts = posts.filter((p) => {
      const d = new Date(p.publishedAt);
      return d >= weekStart && d <= weekEnd;
    });
    weeks.push({
      week: label,
      dateRange,
      views: weekPosts.reduce((s, p) => s + p.views, 0),
      engagement: weekPosts.reduce((s, p) => s + p.likes + p.comments, 0),
    });
  }
  return weeks;
}

export interface PostData {
  id: string;
  title: string;
  format: string;
  publishedAt: string; // ISO string from server
  views: number;
  likes: number;
  comments: number;
  postUrl: string | null;
}

export interface BestTimeEntry {
  platform: string;
  heatmap: HeatmapData;
  updatedAt: string;
}

export interface FollowerStatsData {
  platform: string;
  date: string; // ISO string from server
  followerCount: number;
  growthDelta: number;
  growthPercent: number;
}

export interface DeepAnalyticsEntry {
  platform: string;
  dataType: string;
  data: { kind: string; payload: unknown };
  updatedAt: string;
}

interface AnalyticsClientProps {
  posts: PostData[];
  bestTimes: BestTimeEntry[];
  followerStats: FollowerStatsData[];
  deepAnalytics: DeepAnalyticsEntry[];
}

type SortKey = "date" | "views" | "engagement";
type SortOrder = "asc" | "desc";
type Section = "overview" | "audience" | "bestTimes" | "performance" | "deep";

const SECTIONS: { id: Section; label: string; icon: typeof TrendingUp }[] = [
  { id: "overview", label: "Overview", icon: TrendingUp },
  { id: "audience", label: "Audience", icon: UserPlus },
  { id: "bestTimes", label: "Best Times", icon: Clock },
  { id: "performance", label: "Post Performance", icon: BarChart2 },
  { id: "deep", label: "Deep Analytics", icon: Layers },
];

const KNOWN_PLATFORMS = new Set(["INSTAGRAM", "TIKTOK", "LINKEDIN", "YOUTUBE", "FACEBOOK"]);

function derivePlatform(format: string): string {
  const f = format.toUpperCase();
  return KNOWN_PLATFORMS.has(f) ? f : "OTHER";
}

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube",
  FACEBOOK: "Facebook",
  OTHER: "Other",
};

const PLATFORM_COLORS: Record<string, string> = {
  INSTAGRAM: "from-blue-600 via-purple-600 to-pink-500",
  TIKTOK: "from-neutral-700 to-neutral-900",
  LINKEDIN: "from-blue-700 to-blue-900",
  YOUTUBE: "from-red-600 to-red-800",
  FACEBOOK: "from-blue-600 to-blue-800",
  OTHER: "from-background-secondary to-background-card",
};

function computeEngagement(post: PostData) {
  if (post.views === 0) return 0;
  return +((post.likes + post.comments) / post.views * 100).toFixed(1);
}

const PLATFORM_LABELS_LOWER: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  facebook: "Facebook",
};

function BestTimeHeatmap({ entry }: { entry: BestTimeEntry }) {
  const offsetHours = getTimezoneOffsetHours();
  const localData = heatmapToLocalTime(entry.heatmap, offsetHours);
  const { grid, bestSlots } = localData;
  const tzLabel = getTimezoneLabel();
  const maxVal = Math.max(...grid.flat().filter((v) => v > 0), 1);

  const colorForValue = (v: number) => {
    if (v <= 0) return "rgba(255,255,255,0.03)";
    const intensity = Math.min(v / maxVal, 1);
    return `rgba(200, 149, 42, ${0.15 + intensity * 0.85})`;
  };

  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            Best Time to Post — {label}
          </h3>
        </div>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Average engagement by day &amp; hour ({tzLabel}).
      </p>

      {/* Heatmap grid */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="min-w-[420px] sm:min-w-[480px]">
          {/* Hour labels (top) */}
          <div className="flex items-center gap-px mb-1">
            <div className="w-8 sm:w-10 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="flex-1 text-center text-[9px] sm:text-[10px] text-text-muted">
                {h % 3 === 0 ? formatHourShort(h) : ""}
              </div>
            ))}
          </div>
          {/* Day rows */}
          {grid.map((row, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-px mb-px">
              <div className="w-8 sm:w-10 shrink-0 text-[9px] sm:text-[10px] font-medium text-text-muted text-right pr-1">
                {DAY_LABELS_SHORT[dayIdx]}
              </div>
              {row.map((val, hourIdx) => (
                <div
                  key={hourIdx}
                  className="flex-1 h-5 sm:h-6 rounded-sm transition-all hover:ring-1 hover:ring-accent-primary/50 cursor-default"
                  style={{ background: colorForValue(val) }}
                  title={`${DAY_LABELS_SHORT[dayIdx]} ${formatHour(hourIdx)} — ${val.toFixed(1)} avg engagement`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Best slots summary */}
      {bestSlots.length > 0 && (
        <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-background-secondary">
          <p className="text-xs font-bold tracking-wider text-accent-primary uppercase mb-3">
            Top Posting Windows
          </p>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {bestSlots.slice(0, 5).map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20"
              >
                <span className="text-xs sm:text-sm font-medium text-text-primary">
                  {DAY_LABELS_SHORT[slot.day]} {formatHour(slot.hour)}
                </span>
                <span className="text-[10px] sm:text-xs text-text-muted">
                  {slot.engagement.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const PLATFORM_LINE_COLORS: Record<string, string> = {
  instagram: "#c8952a",
  tiktok: "#0fcfe3",
  linkedin: "#4f8eff",
  youtube: "#ff4757",
  facebook: "#3b82f6",
};

function buildFollowerGrowthData(followerStats: FollowerStatsData[]) {
  const byPlatform: Record<string, FollowerStatsData[]> = {};
  for (const stat of followerStats) {
    if (!byPlatform[stat.platform]) byPlatform[stat.platform] = [];
    byPlatform[stat.platform].push(stat);
  }

  const allDates = new Set<string>();
  for (const stats of Object.values(byPlatform)) {
    for (const s of stats) allDates.add(s.date);
  }
  const sortedDates = Array.from(allDates).sort();

  const chartData = sortedDates.map((date) => {
    const entry: Record<string, number | string> = { date };
    for (const [platform, stats] of Object.entries(byPlatform)) {
      const point = stats.find((s) => s.date === date);
      entry[platform] = point ? point.followerCount : 0;
    }
    return entry;
  });

  return { chartData, platforms: Object.keys(byPlatform) };
}

function FollowerGrowthChart({ followerStats }: { followerStats: FollowerStatsData[] }) {
  const { chartData, platforms } = buildFollowerGrowthData(followerStats);

  const summaries = platforms.map((platform) => {
    const stats = followerStats.filter((s) => s.platform === platform);
    const latest = stats[stats.length - 1];
    const weekAgoIdx = Math.max(0, stats.length - 8);
    const weekAgo = stats[weekAgoIdx];
    const weeklyDelta = latest ? latest.followerCount - (weekAgo?.followerCount ?? latest.followerCount) : 0;
    const weeklyPercent =
      latest && weekAgo && weekAgo.followerCount > 0
        ? ((weeklyDelta / weekAgo.followerCount) * 100).toFixed(1)
        : "0";
    return {
      platform,
      label: PLATFORM_LABELS_LOWER[platform.toLowerCase()] ?? platform,
      latestCount: latest?.followerCount ?? 0,
      weeklyDelta,
      weeklyPercent,
    };
  });

  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Thin out X-axis ticks on small screens to prevent label overlap
  const tickInterval = chartData.length > 30 ? Math.floor(chartData.length / 8) : 0;

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-5 w-5 text-accent-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            Follower Growth
          </h3>
        </div>
        <p className="text-xs sm:text-sm text-text-muted mt-1">
          Daily follower count across your connected platforms
        </p>
      </div>

      {/* Per-platform summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        {summaries.map((s) => {
          const sign = s.weeklyDelta >= 0 ? "+" : "";
          const isPositive = s.weeklyDelta >= 0;
          return (
            <div
              key={s.platform}
              className="flex items-center justify-between rounded-lg bg-background-secondary/50 border border-background-secondary px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs text-text-muted truncate">{s.label}</p>
                <p className="text-base sm:text-lg font-bold text-text-primary mt-0.5">
                  {formatNumber(s.latestCount)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p
                  className={`text-sm font-medium ${isPositive ? "text-brand-expert" : "text-red-400"}`}
                >
                  {sign}{s.weeklyDelta}
                </p>
                <p className="text-xs text-text-muted">
                  {sign}{s.weeklyPercent}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Line chart */}
      <div className="h-64 sm:h-72 w-full overflow-x-auto">
        <div className="min-w-[280px] h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="date"
                stroke="#787878"
                tick={{ fill: "#787878", fontSize: 10 }}
                tickLine={false}
                tickFormatter={formatDateShort}
                minTickGap={15}
                interval={tickInterval}
              />
            <YAxis
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#e8e8e8",
              }}
              labelFormatter={(label) => formatDateShort(String(label))}
              formatter={(value, name) => [
                typeof value === "number" ? formatNumber(value) : value,
                PLATFORM_LABELS_LOWER[String(name).toLowerCase()] ?? String(name),
              ]}
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="circle"
              formatter={(value) =>
                PLATFORM_LABELS_LOWER[String(value).toLowerCase()] ?? String(value)
              }
            />
            {platforms.map((platform) => (
              <Line
                key={platform}
                type="monotone"
                dataKey={platform}
                name={platform}
                stroke={PLATFORM_LINE_COLORS[platform.toLowerCase()] ?? "#c8952a"}
                strokeWidth={2.5}
                dot={{ r: 3, strokeWidth: 1 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Deep Analytics Visualizations ──────────────────────────────────

function DemographicsCard({ entry }: { entry: DeepAnalyticsEntry }) {
  const demo = entry.data.payload as {
    age?: { range: string; percent: number }[];
    gender?: { label: string; percent: number }[];
  };
  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  const ageData = (demo.age ?? []).filter((a) => a.percent > 0).sort((a, b) => b.percent - a.percent);
  const genderData = (demo.gender ?? []).filter((g) => g.percent > 0).sort((a, b) => b.percent - a.percent);

  if (ageData.length === 0 && genderData.length === 0) return null;

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <Users className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Audience Demographics — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Age and gender breakdown of your {label} audience
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {genderData.length > 0 && (
          <div>
            <p className="text-xs font-bold tracking-wider text-accent-primary uppercase mb-3">Gender</p>
            <div className="space-y-2.5">
              {genderData.map((g) => (
                <div key={g.label}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="text-text-primary capitalize min-w-0 truncate">{g.label}</span>
                    <span className="text-text-muted font-medium shrink-0">{g.percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-primary to-amber-400 rounded-full"
                      style={{ width: `${Math.min(g.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ageData.length > 0 && (
          <div>
            <p className="text-xs font-bold tracking-wider text-accent-primary uppercase mb-3">Age Range</p>
            <div className="space-y-2.5">
              {ageData.map((a) => (
                <div key={a.range}>
                  <div className="flex items-center justify-between text-sm mb-1 gap-2">
                    <span className="text-text-primary min-w-0 truncate">{a.range}</span>
                    <span className="text-text-muted font-medium shrink-0">{a.percent.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-accent-primary to-amber-400 rounded-full"
                      style={{ width: `${Math.min(a.percent, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RetentionCurveChart({ entry }: { entry: DeepAnalyticsEntry }) {
  const retention = entry.data.payload as {
    points: { time: number; percent: number }[];
    avgViewDuration?: number;
    avgViewDurationPercent?: number;
  };
  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  const points = retention.points ?? [];
  if (points.length === 0) return null;

  const chartData = points.map((p) => ({
    time: p.time,
    percent: p.percent,
  }));

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <PlayCircle className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Audience Retention — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        See exactly when viewers drop off — use this to optimize hook placement and video length
      </p>

      {(retention.avgViewDuration || retention.avgViewDurationPercent) && (
        <div className="flex flex-wrap gap-3 mb-4">
          {retention.avgViewDuration && (
            <div className="px-3 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
              <span className="text-xs text-text-muted">Avg View Duration: </span>
              <span className="text-sm font-medium text-accent-primary">{formatTime(retention.avgViewDuration)}</span>
            </div>
          )}
          {retention.avgViewDurationPercent && (
            <div className="px-3 py-1.5 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
              <span className="text-xs text-text-muted">Retention: </span>
              <span className="text-sm font-medium text-accent-primary">{retention.avgViewDurationPercent.toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8952a" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#c8952a" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="time"
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 10 }}
              tickLine={false}
              tickFormatter={formatTime}
              minTickGap={30}
            />
            <YAxis
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 10 }}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#e8e8e8",
              }}
              labelFormatter={(label) => formatTime(Number(label))}
              formatter={(value) => [`${Number(value).toFixed(1)}%`, "Retention"]}
            />
            <Area
              type="monotone"
              dataKey="percent"
              stroke="#c8952a"
              strokeWidth={2.5}
              fill="url(#retentionGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DailyViewsChart({ entry }: { entry: DeepAnalyticsEntry }) {
  const views = entry.data.payload as { points: { date: string; views: number }[] };
  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  const points = views.points ?? [];
  if (points.length === 0) return null;

  const chartData = points.map((p) => ({
    date: p.date,
    views: p.views,
  }));

  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <Eye className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Daily Views — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Daily view count over time
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4757" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#ff4757" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="date"
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 10 }}
              tickLine={false}
              tickFormatter={formatDateShort}
              minTickGap={30}
            />
            <YAxis
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 10 }}
              tickLine={false}
              tickFormatter={(v) => formatNumber(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#e8e8e8",
              }}
              labelFormatter={(label) => formatDateShort(String(label))}
              formatter={(value) => [formatNumber(Number(value)), "Views"]}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke="#ff4757"
              strokeWidth={2.5}
              fill="url(#viewsGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MetricsListCard({ entry, title }: { entry: DeepAnalyticsEntry; title: string }) {
  const data = entry.data.payload as { metrics: { label: string; value: number }[] };
  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  const metrics = data.metrics ?? [];
  if (metrics.length === 0) return null;

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          {title} — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Key metrics from your {label} account
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg bg-background-secondary/50 border border-background-secondary px-4 py-3"
          >
            <p className="text-xs text-text-muted truncate">{m.label}</p>
            <p className="text-base sm:text-lg font-bold text-text-primary mt-0.5">
              {formatNumber(m.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostReactionsCard({ entry }: { entry: DeepAnalyticsEntry }) {
  const data = entry.data.payload as { reactions: { type: string; count: number }[] };
  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;

  const reactions = data.reactions ?? [];
  if (reactions.length === 0) return null;

  const total = reactions.reduce((s, r) => s + r.count, 0);

  return (
    <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Post Reactions — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Breakdown of reaction types across your posts ({formatNumber(total)} total)
      </p>
      <div className="space-y-2.5">
        {reactions.map((r) => {
          const pctVal = total > 0 ? (r.count / total) * 100 : 0;
          return (
            <div key={r.type}>
              <div className="flex items-center justify-between text-sm mb-1 gap-2">
                <span className="text-text-primary capitalize min-w-0 truncate">{r.type}</span>
                <span className="text-text-muted font-medium shrink-0 whitespace-nowrap">{formatNumber(r.count)} ({pctVal.toFixed(0)}%)</span>
              </div>
              <div className="h-2.5 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-primary to-amber-400 rounded-full"
                  style={{ width: `${Math.min(pctVal, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentDecayCard({ entry }: { entry: DeepAnalyticsEntry }) {
  const data = entry.data.payload as { buckets: ContentDecayBucket[] };
  const buckets = data.buckets ?? [];
  if (buckets.length === 0) return null;

  const label = PLATFORM_LABELS_LOWER[entry.platform.toLowerCase()] ?? entry.platform;
  const chartData = buckets.map((b) => ({ label: b.label, pct: b.pctOfFinal, postCount: b.postCount }));
  const totalPosts = buckets.reduce((s, b) => s + b.postCount, 0);
  const gradId = `decayGrad-${entry.platform}`;

  const lifespanInsight = generateLifespanInsight(buckets, entry.platform);
  const cadenceRec = generateCadenceRecommendation(buckets);

  return (
    <div className="bg-background-card rounded-xl p-5 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <Timer className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Content Decay — {label}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        How quickly engagement accumulates after publishing — based on {formatNumber(totalPosts)} posts
      </p>

      {/* Lifespan Insight */}
      {lifespanInsight && (
        <div className="flex items-start gap-3 mb-3 p-3 rounded-lg bg-accent-primary/10 border border-accent-primary/20">
          <Timer className="h-4 w-4 text-accent-primary shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary leading-relaxed">{lifespanInsight}</p>
        </div>
      )}

      {/* Cadence Recommendation */}
      {cadenceRec && (
        <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <TrendingUp className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-text-primary leading-relaxed">{cadenceRec}</p>
        </div>
      )}

      {/* Area Chart */}
      <div className="h-48 w-full mb-4 overflow-x-auto">
        <div className="min-w-[280px] h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c8952a" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#c8952a" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="label"
                stroke="#787878"
                tick={{ fill: "#787878", fontSize: 10 }}
                tickLine={false}
                minTickGap={20}
              />
              <YAxis
                stroke="#787878"
                tick={{ fill: "#787878", fontSize: 10 }}
                tickLine={false}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#e8e8e8",
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, "Engagement Reached"]}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#c8952a"
                strokeWidth={2.5}
                fill={`url(#${gradId})`}
                dot={{ fill: "#c8952a", strokeWidth: 1, r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bucket breakdown bars */}
      <div className="space-y-3">
        {chartData.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-sm mb-1 gap-2">
              <span className="text-text-primary min-w-0 truncate">{b.label}</span>
              <span className="text-text-muted font-medium shrink-0">{b.pct.toFixed(0)}% · {b.postCount} posts</span>
            </div>
            <div className="h-2.5 w-full bg-background-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-primary rounded-full transition-all"
                style={{ width: `${Math.min(b.pct, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyMetricsChart({ entry }: { entry: DeepAnalyticsEntry }) {
  const data = entry.data.payload as { points: { date: string; postCount: number; metrics: { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; views: number } }[] };
  const points = data.points ?? [];
  if (points.length === 0) return null;

  const chartData = points.map((p) => ({
    date: p.date,
    views: p.metrics.views,
    impressions: p.metrics.impressions,
    reach: p.metrics.reach,
    engagement: p.metrics.likes + p.metrics.comments + p.metrics.shares + p.metrics.saves,
  }));

  return (
    <div className="bg-background-card rounded-xl p-5 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <BarChart2 className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Daily Metrics
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Daily aggregated views, impressions, reach, and engagement across all platforms
      </p>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="dailyMetricsViewsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8952a" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#c8952a" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="engagementGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0fcfe3" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0fcfe3" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              dataKey="date"
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 11 }}
              tickLine={false}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis
              stroke="#787878"
              tick={{ fill: "#787878", fontSize: 12 }}
              tickLine={false}
              tickFormatter={(value) => formatNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a1a",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                color: "#e8e8e8",
              }}
              formatter={(value) => [typeof value === "number" ? formatNumber(value) : value, ""]}
            />
            <Area type="monotone" dataKey="views" stroke="#c8952a" strokeWidth={2} fill="url(#dailyMetricsViewsGrad)" name="Views" />
            <Area type="monotone" dataKey="engagement" stroke="#0fcfe3" strokeWidth={2} fill="url(#engagementGrad)" name="Engagement" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PostingFrequencyCard({ entry }: { entry: DeepAnalyticsEntry }) {
  const data = entry.data.payload as { rows: { platform: string; postsPerWeek: number; avgEngagementRate: number; avgEngagement: number; weeksCount: number }[] };
  const rows = data.rows ?? [];
  if (rows.length === 0) return null;

  const byPlatform = rows.reduce((acc, r) => {
    if (!acc[r.platform]) acc[r.platform] = [];
    acc[r.platform].push(r);
    return acc;
  }, {} as Record<string, typeof rows>);

  return (
    <div className="bg-background-card rounded-xl p-5 sm:p-6 border border-background-secondary">
      <div className="flex items-center gap-2 mb-1">
        <Activity className="h-5 w-5 text-accent-primary shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
          Posting Frequency vs Engagement
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-text-muted mb-4 sm:mb-5">
        Find your optimal posting cadence — how posts per week correlate with engagement rate
      </p>

      <div className="space-y-5">
        {Object.entries(byPlatform).map(([platform, platformRows]) => {
          const sorted = [...platformRows].sort((a, b) => a.postsPerWeek - b.postsPerWeek);
          const maxRate = Math.max(...sorted.map((r) => r.avgEngagementRate), 1);
          const best = sorted.reduce((a, b) => a.avgEngagementRate > b.avgEngagementRate ? a : b);
          return (
            <div key={platform}>
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-sm font-medium text-text-primary capitalize">{platform}</span>
                <span className="text-xs text-accent-primary shrink-0">
                  Best: {best.postsPerWeek}/wk → {best.avgEngagementRate.toFixed(1)}% engagement
                </span>
              </div>
              <div className="flex items-end gap-2 h-32 pt-5">
                {sorted.map((r) => {
                  const BAR_MAX_PX = 80;
                  const barH = Math.max(Math.round((r.avgEngagementRate / maxRate) * BAR_MAX_PX), 3);
                  const isBest = r.postsPerWeek === best.postsPerWeek;
                  return (
                    <div key={r.postsPerWeek} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[10px] text-text-muted">{r.avgEngagementRate.toFixed(1)}%</span>
                      <div
                        className={`w-full rounded-t transition-all ${isBest ? "bg-accent-primary" : "bg-accent-primary/40"}`}
                        style={{ height: `${barH}px` }}
                      />
                      <span className="text-[10px] text-text-muted">{r.postsPerWeek}/wk</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderDeepAnalyticsCard(entry: DeepAnalyticsEntry): React.ReactNode {
  const { kind } = entry.data;
  switch (kind) {
    case "demographics":
      return <DemographicsCard key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "retention":
      return <RetentionCurveChart key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "dailyViews":
      return <DailyViewsChart key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "accountInsights":
      return <MetricsListCard key={`${entry.platform}-${entry.dataType}`} entry={entry} title="Account Insights" />;
    case "channelInsights":
      return <MetricsListCard key={`${entry.platform}-${entry.dataType}`} entry={entry} title="Channel Insights" />;
    case "pageInsights":
      return <MetricsListCard key={`${entry.platform}-${entry.dataType}`} entry={entry} title="Page Insights" />;
    case "postReactions":
      return <PostReactionsCard key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "contentDecay":
      return <ContentDecayCard key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "dailyMetrics":
      return <DailyMetricsChart key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    case "postingFrequency":
      return <PostingFrequencyCard key={`${entry.platform}-${entry.dataType}`} entry={entry} />;
    default:
      return null;
  }
}

export default function AnalyticsClient({ posts, bestTimes, followerStats, deepAnalytics }: AnalyticsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [seeding, setSeeding] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>("ALL");
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [activeSection, setActiveSection] = useState<Section>("overview");

  const platformTabs = useMemo(() => {
    const present = new Set<string>();
    posts.forEach((p) => present.add(derivePlatform(p.format)));
    followerStats.forEach((s) => present.add(s.platform.toUpperCase()));
    bestTimes.forEach((b) => present.add(b.platform.toUpperCase()));
    const order = ["INSTAGRAM", "TIKTOK", "LINKEDIN", "YOUTUBE", "FACEBOOK", "OTHER"];
    const seen = new Set(order);
    present.forEach((p) => { if (!seen.has(p)) order.push(p); });
    return order.filter((pl) => present.has(pl));
  }, [posts, followerStats, bestTimes]);

  const filteredPosts = useMemo(() => {
    if (activePlatform === "ALL") return posts;
    return posts.filter((p) => derivePlatform(p.format) === activePlatform);
  }, [posts, activePlatform]);

  const filteredFollowerStats = useMemo(() => {
    if (activePlatform === "ALL") return followerStats;
    return followerStats.filter((s) => s.platform.toUpperCase() === activePlatform);
  }, [followerStats, activePlatform]);

  const filteredBestTimes = useMemo(() => {
    if (activePlatform === "ALL") return bestTimes;
    return bestTimes.filter((b) => b.platform.toUpperCase() === activePlatform);
  }, [bestTimes, activePlatform]);

  const filteredDeepAnalytics = useMemo(() => {
    if (activePlatform === "ALL") return deepAnalytics;
    return deepAnalytics.filter((d) => d.platform.toUpperCase() === activePlatform || d.platform === "ALL");
  }, [deepAnalytics, activePlatform]);

  const fetchInsight = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getCachedInsight();
      if (result.success && result.insight) {
        setAiInsight(result.insight);
      } else {
        setAiError(result.error || "Unable to load insight");
      }
    } catch (e) {
      console.error("AI Insight fetch error:", e);
      setAiError("Failed to load insight");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const trendData = buildTrendData(filteredPosts);

  const totalViews = filteredPosts.reduce((sum, p) => sum + p.views, 0);
  const totalLikes = filteredPosts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = filteredPosts.reduce((sum, p) => sum + p.comments, 0);
  const avgEngagement = totalViews > 0
    ? +((totalLikes + totalComments) / totalViews * 100).toFixed(1)
    : 0;

  const stats = [
    { name: "Total Views", value: formatNumber(totalViews), change: filteredPosts.length > 0 ? "+12%" : "—", icon: Eye },
    { name: "Engagement Rate", value: `${avgEngagement}%`, change: filteredPosts.length > 0 ? "+2.1%" : "—", icon: Heart },
    { name: "Total Interactions", value: formatNumber(totalLikes + totalComments), change: filteredPosts.length > 0 ? "+5%" : "—", icon: Users },
    { name: "Total Posts", value: String(filteredPosts.length), change: filteredPosts.length > 0 ? `+${filteredPosts.length}` : "—", icon: FileText },
  ];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    let comparison = 0;
    if (sortKey === "date") {
      comparison = new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
    } else if (sortKey === "views") {
      comparison = a.views - b.views;
    } else if (sortKey === "engagement") {
      comparison = computeEngagement(a) - computeEngagement(b);
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await seedPostAnalytics();
      window.location.reload();
    } catch {
      // silent
    } finally {
      setSeeding(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-text-muted" />;
    return sortOrder === "asc" ? (
      <ChevronUp className="h-4 w-4 text-accent-primary" />
    ) : (
      <ChevronDown className="h-4 w-4 text-accent-primary" />
    );
  };

  const platformIcon = (format: string) => {
    const f = format.toUpperCase();
    if (f === "INSTAGRAM") return <Share2 className="h-5 w-5 text-white" />;
    if (f === "TIKTOK") return <Music2 className="h-5 w-5 text-white" />;
    if (f === "LINKEDIN") return <BarChart2 className="h-5 w-5 text-white" />;
    if (f === "YOUTUBE") return <PlayCircle className="h-5 w-5 text-white" />;
    if (f === "FACEBOOK") return <Share2 className="h-5 w-5 text-white" />;
    return <MonitorPlay className="h-5 w-5 text-white" />;
  };

  const platformBg = (format: string) => {
    const f = format.toUpperCase();
    if (f === "INSTAGRAM") return "bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500";
    if (f === "TIKTOK") return "bg-neutral-800";
    if (f === "LINKEDIN") return "bg-blue-700";
    if (f === "YOUTUBE") return "bg-red-600";
    if (f === "FACEBOOK") return "bg-blue-600";
    return "bg-background-secondary";
  };

  const formatBadge = (format: string) => {
    const colors: Record<string, string> = {
      REEL: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      CAROUSEL: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      STATIC: "bg-green-500/20 text-green-400 border-green-500/30",
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colors[format] || "bg-background-secondary text-text-muted"}`}>
        {format}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
            Analytics
          </h1>
          <p className="text-text-muted mt-1">
            Track your content performance and audience growth
          </p>
        </div>
        <div className="sm:hidden absolute top-0 right-0">
          <SyncButton />
        </div>
        {posts.length === 0 && (
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50 shrink-0"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            Seed Demo Data
          </button>
        )}
      </div>

      {/* Platform Tabs */}
      {platformTabs.length > 0 && (
        <div className="flex items-center gap-1 p-1 bg-background-card border border-background-secondary rounded-xl overflow-x-auto">
          <button
            onClick={() => setActivePlatform("ALL")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activePlatform === "ALL"
                ? "bg-accent-primary text-background-primary"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Layers className="h-4 w-4" />
            All Platforms
          </button>
          {platformTabs.map((platform) => (
            <button
              key={platform}
              onClick={() => setActivePlatform(platform)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activePlatform === platform
                  ? "bg-accent-primary text-background-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <span className={`h-3 w-3 rounded-full bg-gradient-to-br ${PLATFORM_COLORS[platform]}`} />
              {PLATFORM_LABELS[platform] ?? platform}
            </button>
          ))}
        </div>
      )}

      {/* Section Sub-Tabs + Sync Button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 bg-background-card border border-background-secondary rounded-xl overflow-x-auto">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  activeSection === section.id
                    ? "bg-accent-primary text-background-primary"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </div>
        <div className="ml-auto hidden sm:block">
          <SyncButton />
        </div>
      </div>

      {/* Overview Section */}
      {activeSection === "overview" && (
        <>
      {/* AI Insights Box */}
      <div className="bg-gradient-to-r from-accent-primary/20 via-accent-primary/10 to-transparent border border-accent-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-primary/20 rounded-lg shrink-0">
            {aiLoading ? (
              <Loader2 className="h-6 w-6 text-accent-primary animate-spin" />
            ) : (
              <Sparkles className="h-6 w-6 text-accent-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-lg font-semibold text-accent-primary">
                AI Insight
              </h3>
              {aiInsight && !aiLoading && (
                <button
                  onClick={() => setInsightExpanded((v) => !v)}
                  className="sm:hidden flex items-center gap-1 text-xs text-accent-primary/70 hover:text-accent-primary transition-colors shrink-0"
                  aria-label={insightExpanded ? "Collapse insight" : "Expand insight"}
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
            {aiLoading && (
              <p className="text-text-muted leading-relaxed">Analyzing your content performance...</p>
            )}
            {aiError && (
              <p className="text-text-muted leading-relaxed">{aiError}</p>
            )}
            {aiInsight && !aiLoading && (
              <>
                {/* Mobile: collapsed shows first sentence only */}
                <p className="sm:hidden text-text-primary leading-relaxed">
                  {insightExpanded
                    ? aiInsight
                    : (aiInsight.match(/^[^.!?]+[.!?]/)?.[0] ?? aiInsight.slice(0, 120) + (aiInsight.length > 120 ? "…" : ""))}
                </p>
                {/* Desktop: always show full insight */}
                <p className="hidden sm:block text-text-primary leading-relaxed">{aiInsight}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-background-card rounded-xl p-6 border border-background-secondary hover:border-accent-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">{stat.name}</p>
                  <p className="text-2xl font-bold text-text-primary mt-1">{stat.value}</p>
                </div>
                <div className="p-3 bg-accent-primary/10 rounded-xl">
                  <Icon className="h-5 w-5 text-accent-primary" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm">
                <span className="text-brand-expert font-medium">{stat.change}</span>
                <span className="text-text-muted ml-2">vs last month</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 8-Week Trend Chart */}
      <div className="bg-background-card rounded-xl p-6 border border-background-secondary">
        <div className="mb-6">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            8-Week Performance Trend
          </h3>
          <p className="text-sm text-text-muted mt-1">
            Views and engagement over the past 8 weeks
          </p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="week"
                stroke="#787878"
                tick={({ x, y, payload, index }: { x: string | number; y: string | number; payload: { value: string }; index: number }) => (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={14} textAnchor="middle" fill="#e8e8e8" fontSize={12} fontWeight={600}>{payload.value}</text>
                    {chartWidth >= 480 && (
                      <text x={0} y={0} dy={28} textAnchor="middle" fill="#787878" fontSize={10}>{trendData[index]?.dateRange ?? ""}</text>
                    )}
                  </g>
                )}
                height={50}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#787878"
                tick={{ fill: "#787878", fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => formatNumber(value)}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#0fcfe3"
                tick={{ fill: "#0fcfe3", fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1a1a1a",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#e8e8e8",
                }}
                formatter={(value) => [typeof value === "number" ? formatNumber(value) : value, ""]}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload as { week: string; dateRange: string } | undefined;
                  return item ? `${item.week} · ${item.dateRange}` : label;
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="circle"
              />
              <Line
                type="monotone"
                yAxisId="left"
                dataKey="views"
                name="Views"
                stroke="#c8952a"
                strokeWidth={3}
                dot={{ fill: "#c8952a", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#c8952a" }}
              />
              <Line
                type="monotone"
                yAxisId="right"
                dataKey="engagement"
                name="Engagement"
                stroke="#0fcfe3"
                strokeWidth={3}
                dot={{ fill: "#0fcfe3", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#0fcfe3" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Follower Growth Chart */}
      {activeSection === "overview" && filteredFollowerStats.length > 0 && <FollowerGrowthChart followerStats={filteredFollowerStats} />}
      </>
      )}

      {/* Audience Section */}
      {activeSection === "audience" && (
        <>
          {filteredFollowerStats.length > 0 ? (
            <FollowerGrowthChart followerStats={filteredFollowerStats} />
          ) : (
            <div className="bg-background-card rounded-xl p-12 border border-background-secondary text-center">
              <UserPlus className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted text-sm">{activePlatform !== "ALL" ? `No audience data for ${PLATFORM_LABELS[activePlatform] ?? activePlatform}` : "No audience data yet — connect a social account to start tracking follower growth"}</p>
            </div>
          )}
        </>
      )}

      {/* Best Times Section */}
      {activeSection === "bestTimes" && (
        <>
          {filteredBestTimes.length > 0 ? (
            <div className="space-y-6">
              {filteredBestTimes.map((entry) => (
                <BestTimeHeatmap key={entry.platform} entry={entry} />
              ))}
            </div>
          ) : (
            <div className="bg-background-card rounded-xl p-12 border border-background-secondary text-center">
              <Clock className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted text-sm">{activePlatform !== "ALL" ? `No best-time data for ${PLATFORM_LABELS[activePlatform] ?? activePlatform}` : "No best-time data yet — connect a social account and sync analytics to see optimal posting times"}</p>
            </div>
          )}
        </>
      )}

      {/* Deep Analytics Section */}
      {activeSection === "deep" && (
        <>
          {filteredDeepAnalytics.length > 0 ? (
            <div className="space-y-6">
              {filteredDeepAnalytics.map((entry) => renderDeepAnalyticsCard(entry))}
            </div>
          ) : (
            <div className="bg-background-card rounded-xl p-12 border border-background-secondary text-center">
              <Layers className="h-10 w-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-muted text-sm">{activePlatform !== "ALL" ? `No deep analytics data for ${PLATFORM_LABELS[activePlatform] ?? activePlatform}` : "No deep analytics yet — connect a social account and sync analytics to unlock platform-specific insights like demographics, retention curves, and more"}</p>
            </div>
          )}
        </>
      )}

      {/* Post Performance Section */}
      {activeSection === "performance" && (
        <>
      {/* Recent Performance Table */}
      <div className="bg-background-card rounded-xl border border-background-secondary overflow-hidden">
        <div className="p-6 border-b border-background-secondary">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            Recent Performance
            {activePlatform !== "ALL" && (
              <span className="ml-2 text-sm font-normal text-text-muted">— {PLATFORM_LABELS[activePlatform] ?? activePlatform}</span>
            )}
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {filteredPosts.length > 0 ? "Posts pulled from your connected accounts" : activePlatform !== "ALL" ? `No posts for ${PLATFORM_LABELS[activePlatform] ?? activePlatform}` : "No post data yet — connect an account or seed demo data"}
          </p>
        </div>

        {filteredPosts.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">No analytics data yet</p>
          </div>
        ) : (
          <>
            {/* Mobile card list (hidden on sm+) */}
            <div className="sm:hidden divide-y divide-background-secondary">
              {sortedPosts.map((post) => (
                <div key={post.id} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <ConditionalLink href={post.postUrl} className={`h-12 w-16 rounded-lg flex items-center justify-center shrink-0 ${platformBg(post.format)}`}>
                      {platformIcon(post.format)}
                    </ConditionalLink>
                    <div className="min-w-0">
                      <ConditionalLink href={post.postUrl} className="font-medium text-text-primary text-sm leading-snug line-clamp-2 hover:text-accent-primary transition-colors">
                        {post.title}
                      </ConditionalLink>
                      <div className="mt-1">{formatBadge(post.format)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-muted">{formatDate(post.publishedAt)}</span>
                    <div className="flex items-center gap-4">
                      <span className="font-medium text-text-primary">{formatNumber(post.views)} views</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-accent-primary">{computeEngagement(post)}%</span>
                        <div className="h-1.5 w-12 bg-background-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-primary rounded-full"
                            style={{ width: `${Math.min(computeEngagement(post) * 5, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table (hidden on mobile) */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-background-secondary">
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Content
                    </th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-text-muted">
                      Format
                    </th>
                    <th
                      className="text-left px-6 py-4 text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-2">
                        Published
                        {getSortIcon("date")}
                      </div>
                    </th>
                    <th
                      className="text-left px-6 py-4 text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                      onClick={() => handleSort("views")}
                    >
                      <div className="flex items-center gap-2">
                        Views
                        {getSortIcon("views")}
                      </div>
                    </th>
                    <th
                      className="text-left px-6 py-4 text-sm font-medium text-text-muted cursor-pointer hover:text-text-primary transition-colors"
                      onClick={() => handleSort("engagement")}
                    >
                      <div className="flex items-center gap-2">
                        Engagement
                        {getSortIcon("engagement")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPosts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-background-secondary last:border-b-0 hover:bg-background-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <ConditionalLink href={post.postUrl} className="flex items-center gap-4 group">
                          <div className={`h-14 w-20 rounded-lg flex items-center justify-center shrink-0 ${platformBg(post.format)}`}>
                            {platformIcon(post.format)}
                          </div>
                          <span className="font-medium text-text-primary line-clamp-2 group-hover:text-accent-primary transition-colors">
                            {post.title}
                          </span>
                        </ConditionalLink>
                      </td>
                      <td className="px-6 py-4">
                        {formatBadge(post.format)}
                      </td>
                      <td className="px-6 py-4 text-sm text-text-muted">
                        {formatDate(post.publishedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-text-primary">
                          {formatNumber(post.views)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-accent-primary">
                            {computeEngagement(post)}%
                          </span>
                          <div className="h-1.5 w-16 bg-background-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent-primary rounded-full"
                              style={{ width: `${Math.min(computeEngagement(post) * 5, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function formatNumber(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
