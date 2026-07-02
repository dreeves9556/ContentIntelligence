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
} from "recharts";
import { seedPostAnalytics, getCachedInsight } from "./actions";
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

interface AnalyticsClientProps {
  posts: PostData[];
  bestTimes: BestTimeEntry[];
  followerStats: FollowerStatsData[];
}

type SortKey = "date" | "views" | "engagement";
type SortOrder = "asc" | "desc";

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

export default function AnalyticsClient({ posts, bestTimes, followerStats }: AnalyticsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [seeding, setSeeding] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string>("ALL");
  const [insightExpanded, setInsightExpanded] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);

  const platformTabs = useMemo(() => {
    const present = new Set(posts.map((p) => derivePlatform(p.format)));
    const order = ["INSTAGRAM", "TIKTOK", "LINKEDIN", "YOUTUBE", "FACEBOOK", "OTHER"];
    return order.filter((pl) => present.has(pl));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (activePlatform === "ALL") return posts;
    return posts.filter((p) => derivePlatform(p.format) === activePlatform);
  }, [posts, activePlatform]);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
            Analytics
          </h1>
          <p className="text-text-muted mt-1">
            Track your content performance and audience growth
          </p>
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
      {followerStats.length > 0 && <FollowerGrowthChart followerStats={followerStats} />}

      {/* Best Time to Post Heatmaps */}
      {bestTimes.length > 0 && (
        <div className="space-y-6">
          {bestTimes.map((entry) => (
            <BestTimeHeatmap key={entry.platform} entry={entry} />
          ))}
        </div>
      )}

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
    </div>
  );
}

function formatNumber(num: number) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}
