"use client";

import { useState } from "react";
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
  Image,
  Loader2,
  Database,
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
import { seedPostAnalytics } from "./actions";

// Mock data for 8-week trend chart (kept as-is — will be wired to real data in a future phase)
const trendData = [
  { week: "Week 1", reach: 45000, engagement: 3200 },
  { week: "Week 2", reach: 52000, engagement: 4100 },
  { week: "Week 3", reach: 48000, engagement: 3800 },
  { week: "Week 4", reach: 61000, engagement: 5200 },
  { week: "Week 5", reach: 58000, engagement: 4800 },
  { week: "Week 6", reach: 72000, engagement: 6500 },
  { week: "Week 7", reach: 68000, engagement: 5900 },
  { week: "Week 8", reach: 85000, engagement: 7800 },
];

export interface PostData {
  id: string;
  title: string;
  format: string;
  publishedAt: string; // ISO string from server
  views: number;
  likes: number;
  comments: number;
}

interface AnalyticsClientProps {
  posts: PostData[];
}

type SortKey = "date" | "views" | "engagement";
type SortOrder = "asc" | "desc";

function computeEngagement(post: PostData) {
  if (post.views === 0) return 0;
  return +((post.likes + post.comments) / post.views * 100).toFixed(1);
}

export default function AnalyticsClient({ posts }: AnalyticsClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [seeding, setSeeding] = useState(false);

  const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likes, 0);
  const totalComments = posts.reduce((sum, p) => sum + p.comments, 0);
  const avgEngagement = totalViews > 0
    ? +((totalLikes + totalComments) / totalViews * 100).toFixed(1)
    : 0;

  const stats = [
    { name: "Total Views", value: formatNumber(totalViews), change: posts.length > 0 ? "+12%" : "—", icon: Eye },
    { name: "Engagement Rate", value: `${avgEngagement}%`, change: posts.length > 0 ? "+2.1%" : "—", icon: Heart },
    { name: "Total Interactions", value: formatNumber(totalLikes + totalComments), change: posts.length > 0 ? "+5%" : "—", icon: Users },
    { name: "Total Posts", value: String(posts.length), change: posts.length > 0 ? `+${posts.length}` : "—", icon: FileText },
  ];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const sortedPosts = [...posts].sort((a, b) => {
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

      {/* AI Insights Box */}
      <div className="bg-gradient-to-r from-accent-primary/20 via-accent-primary/10 to-transparent border border-accent-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-primary/20 rounded-lg shrink-0">
            <Sparkles className="h-6 w-6 text-accent-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-accent-primary mb-2">
              AI Insight
            </h3>
            <p className="text-text-primary leading-relaxed">
              {"Your Reels are up "}
              <span className="text-brand-expert font-semibold">20%</span>
              {" this week. Keep leaning into local community content — posts featuring neighborhood businesses are performing "}
              <span className="text-brand-expert font-semibold">35% better</span>
              {" than average. Consider creating a weekly \"Local Spotlight\" series to capitalize on this trend."}
            </p>
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
            Reach and engagement over the past 8 weeks
          </p>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="week"
                stroke="#787878"
                tick={{ fill: "#787878", fontSize: 12 }}
                tickLine={false}
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
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey="reach"
                name="Reach"
                stroke="#c8952a"
                strokeWidth={3}
                dot={{ fill: "#c8952a", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: "#c8952a" }}
              />
              <Line
                type="monotone"
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

      {/* Recent Performance Table */}
      <div className="bg-background-card rounded-xl border border-background-secondary overflow-hidden">
        <div className="p-6 border-b border-background-secondary">
          <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-playfair)" }}>
            Recent Performance
          </h3>
          <p className="text-sm text-text-muted mt-1">
            {posts.length > 0 ? "Posts pulled from your connected accounts" : "No post data yet — connect an account or seed demo data"}
          </p>
        </div>

        {posts.length === 0 ? (
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
                    <div className="h-12 w-16 bg-background-secondary rounded-lg flex items-center justify-center shrink-0">
                      <Image className="h-4 w-4 text-text-muted" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary text-sm leading-snug line-clamp-2">
                        {post.title}
                      </p>
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
                        <div className="flex items-center gap-4">
                          <div className="h-14 w-20 bg-background-secondary rounded-lg flex items-center justify-center shrink-0">
                            <Image className="h-5 w-5 text-text-muted" />
                          </div>
                          <span className="font-medium text-text-primary line-clamp-2">
                            {post.title}
                          </span>
                        </div>
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
