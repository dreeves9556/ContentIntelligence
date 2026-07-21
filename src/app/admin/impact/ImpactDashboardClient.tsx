"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  TrendingUp, Users, UserPlus, Eye, Heart, FileText, Activity,
  AlertTriangle, Copy, Check, Loader2, RefreshCw, Database,
  ChevronUp, ChevronDown, ArrowUpDown, ShieldAlert, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import type { ImpactData } from "./actions";
import { backfillBaselines, recalculateEngagementBaselinesAction, getCachedImpactInsight, generateImpactInsight } from "./actions";

const PLATFORM_LABELS: Record<string, string> = {
  INSTAGRAM: "Instagram", TIKTOK: "TikTok", LINKEDIN: "LinkedIn",
  YOUTUBE: "YouTube", FACEBOOK: "Facebook",
};

function formatNumber(num: number): string {
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return String(Math.round(num));
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercent(num: number, decimals = 1): string {
  const sign = num >= 0 ? "+" : "";
  return `${sign}${num.toFixed(decimals)}%`;
}

type SortKey = "followersGained" | "growthPercent" | "engagementLift" | "lastSyncAt";
type SortOrder = "asc" | "desc";

export default function ImpactDashboardClient({ data }: { data: ImpactData }) {
  const [sortKey, setSortKey] = useState<SortKey>("followersGained");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [platformFilter, setPlatformFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planFilter, setPlanFilter] = useState("ALL");
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcResult, setRecalcResult] = useState<string | null>(null);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [copiedStat, setCopiedStat] = useState<string | null>(null);
  const [aiInsight, setAiInsight] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [insightExpanded, setInsightExpanded] = useState(false);

  const { overview, timeSeries, engagementTimeSeries, memberRows,
    platformBreakdown, cohortBreakdown, usageCorrelation, dataQuality } = data;

  const fetchInsight = useCallback(async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await getCachedImpactInsight();
      if (result.success && result.insight) {
        setAiInsight(result.insight);
      } else if (result.error) {
        setAiError(result.error);
      }
    } catch (e) {
      setAiError("Failed to load insight");
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  const handleGenerateInsight = useCallback(async () => {
    setAiGenerating(true);
    setAiError(null);
    try {
      const result = await generateImpactInsight();
      if (result.success && result.insight) {
        setAiInsight(result.insight);
      } else {
        setAiError(result.error || "Failed to generate insight");
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Failed to generate insight");
    } finally {
      setAiGenerating(false);
    }
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("desc"); }
  };

  const getSortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-4 w-4 text-text-muted" />;
    return sortOrder === "asc" ? <ChevronUp className="h-4 w-4 text-accent-primary" /> : <ChevronDown className="h-4 w-4 text-accent-primary" />;
  };

  const filteredRows = useMemo(() => {
    let rows = [...memberRows];
    if (platformFilter !== "ALL") rows = rows.filter((r) => r.platform === platformFilter);
    if (statusFilter === "ACTIVE") rows = rows.filter((r) => r.isActive);
    else if (statusFilter === "INACTIVE") rows = rows.filter((r) => !r.isActive);
    if (planFilter !== "ALL") rows = rows.filter((r) => r.plan === planFilter);
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "followersGained") cmp = (a.followersGained ?? -Infinity) - (b.followersGained ?? -Infinity);
      else if (sortKey === "growthPercent") cmp = (a.growthPercent ?? -Infinity) - (b.growthPercent ?? -Infinity);
      else if (sortKey === "engagementLift") cmp = (a.engagementLift ?? -Infinity) - (b.engagementLift ?? -Infinity);
      else if (sortKey === "lastSyncAt") {
        const aT = a.lastSyncAt ? new Date(a.lastSyncAt).getTime() : 0;
        const bT = b.lastSyncAt ? new Date(b.lastSyncAt).getTime() : 0;
        cmp = aT - bT;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [memberRows, sortKey, sortOrder, platformFilter, statusFilter, planFilter]);

  const platforms = useMemo(() => Array.from(new Set(memberRows.map((r) => r.platform))).sort(), [memberRows]);
  const plans = useMemo(() => Array.from(new Set(memberRows.map((r) => r.plan))).sort(), [memberRows]);

  const handleBackfill = useCallback(async () => {
    setBackfillLoading(true); setBackfillResult(null);
    try {
      const r = await backfillBaselines();
      setBackfillResult(r.success ? `Created ${r.created}, skipped ${r.skipped}, ${r.missingFollowerStats} missing data.` : `Error: ${r.error}`);
    } catch (e) { setBackfillResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`); }
    finally { setBackfillLoading(false); }
  }, []);

  const handleRecalculate = useCallback(async () => {
    setRecalcLoading(true); setRecalcResult(null); setShowRecalcConfirm(false);
    try {
      const r = await recalculateEngagementBaselinesAction();
      setRecalcResult(r.success ? `Updated ${r.updated}, skipped ${r.skipped}.` : `Error: ${r.error}`);
    } catch (e) { setRecalcResult(`Error: ${e instanceof Error ? e.message : "Unknown"}`); }
    finally { setRecalcLoading(false); }
  }, []);

  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedStat(id); setTimeout(() => setCopiedStat(null), 2000); } catch {}
  }, []);

  const salesStats = [
    { id: "growth", label: "Follower Growth", text: `${overview.connectedMembers} members have tracked ${formatNumber(overview.totalFollowersGained)} followers gained across ${overview.connectedAccounts} connected social accounts since joining The Local Post. Average follower growth: ${formatPercent(overview.avgFollowerGrowth)}.` },
    { id: "engagement", label: "Engagement Lift", text: `Members show an average engagement rate lift of ${formatPercent(overview.avgEngagementLift)} since joining, with ${formatNumber(overview.totalViewsTracked)} total views tracked across ${formatNumber(overview.totalPostsTracked)} posts.` },
    { id: "usage", label: "Usage Correlation", text: `${overview.activeUsers} active members show ${formatPercent(usageCorrelation.activeAvgGrowth)} average follower growth, compared to ${formatPercent(usageCorrelation.inactiveAvgGrowth)} for inactive members.` },
  ];

  const cards = [
    { name: "Connected Members", value: String(overview.connectedMembers), icon: Users },
    { name: "Connected Accounts", value: String(overview.connectedAccounts), icon: UserPlus },
    { name: "Total Followers Gained", value: formatNumber(overview.totalFollowersGained), icon: TrendingUp },
    { name: "Avg Follower Growth", value: formatPercent(overview.avgFollowerGrowth), icon: TrendingUp },
    { name: "Avg Engagement Lift", value: formatPercent(overview.avgEngagementLift), icon: Heart },
    { name: "Total Views Tracked", value: formatNumber(overview.totalViewsTracked), icon: Eye },
    { name: "Total Posts Tracked", value: formatNumber(overview.totalPostsTracked), icon: FileText },
    { name: "Active Users (30d)", value: String(overview.activeUsers), icon: Activity },
  ];

  const tooltipStyle = {
    backgroundColor: "var(--color-background-card)", border: "1px solid var(--color-border-primary)",
    borderRadius: "8px", color: "var(--color-text-primary)",
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>Local Post Impact</h1>
        <p className="text-text-muted mt-1">Track member growth, engagement lift, and platform-wide results since joining The Local Post.</p>
        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <ShieldAlert className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-xs text-text-muted leading-relaxed">These stats show tracked growth and engagement trends for connected accounts. They should be used as directional evidence, not guaranteed attribution. Individual results may vary.</p>
        </div>
      </div>

      {/* AI Insight Box */}
      <div className="bg-gradient-to-r from-accent-primary/20 via-accent-primary/10 to-transparent border border-accent-primary/30 rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-primary/20 rounded-lg shrink-0">
            {aiLoading || aiGenerating ? (
              <Loader2 className="h-6 w-6 text-accent-primary animate-spin" />
            ) : (
              <Sparkles className="h-6 w-6 text-accent-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-lg font-semibold text-accent-primary">
                AI Marketing Insight
              </h3>
              <button
                onClick={handleGenerateInsight}
                disabled={aiGenerating || aiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent-primary/20 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/30 transition-all disabled:opacity-50 shrink-0"
              >
                {aiGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {aiInsight ? "Regenerate" : "Generate"}
              </button>
            </div>
            {aiLoading && (
              <p className="text-text-muted leading-relaxed">Loading cached insight...</p>
            )}
            {aiError && !aiLoading && (
              <p className="text-text-muted leading-relaxed">{aiError}</p>
            )}
            {!aiLoading && !aiError && !aiInsight && (
              <p className="text-text-muted leading-relaxed">
                No insight generated yet. Click "Generate" to create advertisement-ready analytics copy from real platform data.
              </p>
            )}
            {aiInsight && !aiLoading && (
              <>
                {/* Mobile: collapsed shows first sentence only */}
                <p className="sm:hidden text-text-primary leading-relaxed">
                  {insightExpanded
                    ? aiInsight
                    : (aiInsight.match(/^[^.!?]+[.!?]/)?.[0] ?? aiInsight.slice(0, 120) + (aiInsight.length > 120 ? "..." : ""))}
                </p>
                {/* Desktop: always show full insight */}
                <p className="hidden sm:block text-text-primary leading-relaxed whitespace-pre-line">{aiInsight}</p>
                {/* Mobile expand/collapse toggle */}
                <button
                  onClick={() => setInsightExpanded((v) => !v)}
                  className="sm:hidden flex items-center gap-1 text-xs text-accent-primary/70 hover:text-accent-primary transition-colors mt-2"
                  aria-label={insightExpanded ? "Collapse insight" : "Expand insight"}
                >
                  {insightExpanded ? (
                    <><ChevronUp className="h-3.5 w-3.5" /> Less</>
                  ) : (
                    <><ChevronDown className="h-3.5 w-3.5" /> More</>
                  )}
                </button>
                {aiInsight.includes("HEADLINE:") && aiInsight.includes("COPY:") && (
                  <button
                    onClick={() => copyToClipboard(aiInsight, "ai-insight")}
                    className="mt-3 flex items-center gap-1.5 text-xs text-accent-primary/70 hover:text-accent-primary transition-colors"
                  >
                    {copiedStat === "ai-insight" ? (
                      <><Check className="h-3.5 w-3.5" /> Copied</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5" /> Copy to clipboard</>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((s) => { const Icon = s.icon; return (
          <div key={s.name} className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary hover:border-accent-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <div><p className="text-xs sm:text-sm text-text-muted">{s.name}</p><p className="text-xl sm:text-2xl font-bold text-text-primary mt-1">{s.value}</p></div>
              <div className="p-2 sm:p-3 bg-accent-primary/10 rounded-xl"><Icon className="h-4 w-4 sm:h-5 sm:w-5 text-accent-primary" /></div>
            </div>
          </div>
        ); })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* A. Total Follower Growth */}
        <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Total Follower Growth</h3></div>
          <p className="text-xs sm:text-sm text-text-muted mb-4">Aggregate follower count across all connected accounts over time</p>
          {timeSeries.length > 0 ? (
            <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeSeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis dataKey="date" stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={formatDateShort} minTickGap={20} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatDateShort(String(l))} formatter={(v) => [formatNumber(Number(v)), "Total Followers"]} />
                <Line type="monotone" dataKey="totalFollowers" name="Total Followers" stroke="var(--color-accent-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-text-muted text-sm">No follower data available yet</div>}
        </div>

        {/* B. Engagement Rate Trend */}
        <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
          <div className="flex items-center gap-2 mb-1"><Heart className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Engagement Rate Trend</h3></div>
          <p className="text-xs sm:text-sm text-text-muted mb-4">Weekly weighted engagement rate across all members</p>
          {engagementTimeSeries.length > 0 ? (
            <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementTimeSeries} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis dataKey="week" stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={formatDateShort} minTickGap={20} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => formatDateShort(String(l))} formatter={(v) => [`${Number(v).toFixed(2)}%`, "Engagement Rate"]} />
                <Line type="monotone" dataKey="engagementRate" name="Engagement Rate" stroke="var(--color-brand-local)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-text-muted text-sm">No engagement data available yet</div>}
        </div>

        {/* C. Growth by Platform */}
        <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Growth by Platform</h3></div>
          <p className="text-xs sm:text-sm text-text-muted mb-4">Followers gained and average growth percentage by platform</p>
          {platformBreakdown.length > 0 ? (
            <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformBreakdown.map((p) => ({ ...p, label: PLATFORM_LABELS[p.platform] ?? p.platform }))} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis dataKey="label" stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => n === "followersGained" ? [formatNumber(Number(v)), "Followers Gained"] : [`${Number(v).toFixed(1)}%`, "Avg Growth %"]} />
                <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" formatter={(v) => v === "followersGained" ? "Followers Gained" : "Avg Growth %"} />
                <Bar dataKey="followersGained" fill="var(--color-accent-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgGrowthPercent" fill="var(--color-brand-local)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-text-muted text-sm">No platform breakdown data available</div>}
        </div>

        {/* D. Cohort Growth */}
        <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
          <div className="flex items-center gap-2 mb-1"><Users className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Cohort Growth</h3></div>
          <p className="text-xs sm:text-sm text-text-muted mb-4">Average growth and engagement lift by join cohort (baseline month)</p>
          {cohortBreakdown.length > 0 ? (
            <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={cohortBreakdown} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-primary)" />
                <XAxis dataKey="cohort" stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} />
                <YAxis stroke="var(--color-text-muted)" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} tickLine={false} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v, n) => n === "avgGrowthPercent" ? [`${Number(v).toFixed(1)}%`, "Avg Growth %"] : [`${Number(v).toFixed(2)}%`, "Avg Engagement Lift"]} />
                <Legend wrapperStyle={{ paddingTop: "10px" }} iconType="circle" formatter={(v) => v === "avgGrowthPercent" ? "Avg Growth %" : "Avg Engagement Lift"} />
                <Bar dataKey="avgGrowthPercent" fill="var(--color-accent-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avgEngagementLift" fill="var(--color-brand-local)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="h-64 flex items-center justify-center text-text-muted text-sm">No cohort data available yet</div>}
        </div>
      </div>

      {/* E. Active vs Inactive */}
      {(usageCorrelation.activeUsers > 0 || usageCorrelation.inactiveUsers > 0) && (
        <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
          <div className="flex items-center gap-2 mb-1"><Activity className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Active vs Inactive Members</h3></div>
          <p className="text-xs sm:text-sm text-text-muted mb-4">Usage correlation: members who actively use The Local Post vs those who don&apos;t (last 30 days)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
              <p className="text-sm font-medium text-emerald-400 mb-3">Active ({usageCorrelation.activeUsers})</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Follower Growth</span><span className="font-medium text-text-primary">{formatPercent(usageCorrelation.activeAvgGrowth)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Engagement Rate</span><span className="font-medium text-text-primary">{usageCorrelation.activeAvgEngagement.toFixed(2)}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Posts Tracked</span><span className="font-medium text-text-primary">{formatNumber(usageCorrelation.activeAvgPosts)}</span></div>
              </div>
            </div>
            <div className="rounded-lg bg-background-secondary border border-border-primary p-4">
              <p className="text-sm font-medium text-text-muted mb-3">Inactive ({usageCorrelation.inactiveUsers})</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Follower Growth</span><span className="font-medium text-text-primary">{formatPercent(usageCorrelation.inactiveAvgGrowth)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Engagement Rate</span><span className="font-medium text-text-primary">{usageCorrelation.inactiveAvgEngagement.toFixed(2)}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-muted">Avg Posts Tracked</span><span className="font-medium text-text-primary">{formatNumber(usageCorrelation.inactiveAvgPosts)}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Copyable Sales Stats */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1"><Copy className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Safe Sales Stats</h3></div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">Copy-paste ready stats with cautious, directional language. No individual names or guaranteed attribution.</p>
        <div className="space-y-3">
          {salesStats.map((stat) => (
            <div key={stat.id} className="flex items-start gap-3 p-3 rounded-lg bg-background-secondary/50 border border-border-primary">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-accent-primary mb-1">{stat.label}</p>
                <p className="text-sm text-text-primary leading-relaxed">{stat.text}</p>
              </div>
              <button onClick={() => copyToClipboard(stat.text, stat.id)} className="shrink-0 p-2 rounded-lg hover:bg-background-secondary transition-colors" aria-label="Copy to clipboard">
                {copiedStat === stat.id ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-text-muted" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Member Growth Table */}
      <div className="bg-background-card rounded-xl border border-border-primary overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border-primary">
          <h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Member Growth Detail</h3>
          <p className="text-xs sm:text-sm text-text-muted mt-1">Per-member growth and engagement since baseline. {filteredRows.length} rows.</p>
        </div>
        {/* Filters */}
        <div className="flex flex-wrap gap-2 p-4 border-b border-border-primary">
          <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background-secondary border border-border-primary text-sm text-text-primary">
            <option value="ALL">All Platforms</option>
            {platforms.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background-secondary border border-border-primary text-sm text-text-primary">
            <option value="ALL">All Status</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
          </select>
          <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="px-3 py-1.5 rounded-lg bg-background-secondary border border-border-primary text-sm text-text-primary">
            <option value="ALL">All Plans</option>
            {plans.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        {/* Table */}
        {filteredRows.length === 0 ? (
          <div className="p-12 text-center"><Database className="h-10 w-10 text-text-muted mx-auto mb-3" /><p className="text-text-muted text-sm">No member data available</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-primary">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Baseline</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Start</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Current</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort("followersGained")}><div className="flex items-center justify-end gap-1">Gained {getSortIcon("followersGained")}</div></th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort("growthPercent")}><div className="flex items-center justify-end gap-1">Growth % {getSortIcon("growthPercent")}</div></th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Base Eng.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Current Eng.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort("engagementLift")}><div className="flex items-center justify-end gap-1">Eng. Lift {getSortIcon("engagementLift")}</div></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted cursor-pointer hover:text-text-primary whitespace-nowrap" onClick={() => handleSort("lastSyncAt")}><div className="flex items-center gap-1">Last Sync {getSortIcon("lastSyncAt")}</div></th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted whitespace-nowrap">Plan</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => (
                  <tr key={`${row.userId}-${row.platform}-${i}`} className="border-b border-border-primary last:border-b-0 hover:bg-background-secondary/50 transition-colors">
                    <td className="px-4 py-3 text-sm">
                      <p className="font-medium text-text-primary truncate max-w-[150px]">{row.userName ?? "Unknown"}</p>
                      <p className="text-xs text-text-muted truncate max-w-[150px]">{row.userEmail ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted whitespace-nowrap">{PLATFORM_LABELS[row.platform] ?? row.platform}</td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{row.baselineDate ? formatDateShort(row.baselineDate) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-text-muted text-right whitespace-nowrap">{row.baselineFollowers != null ? formatNumber(row.baselineFollowers) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-text-primary text-right whitespace-nowrap">{row.currentFollowers != null ? formatNumber(row.currentFollowers) : "—"}</td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap"><span className={row.followersGained != null && row.followersGained >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>{row.followersGained != null ? (row.followersGained >= 0 ? "+" : "") + formatNumber(row.followersGained) : "—"}</span></td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap"><span className={row.growthPercent != null && row.growthPercent >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>{row.growthPercent != null ? formatPercent(row.growthPercent) : "—"}</span></td>
                    <td className="px-4 py-3 text-xs text-text-muted text-right whitespace-nowrap">{row.baselineEngagement != null ? row.baselineEngagement.toFixed(2) + "%" : "—"}</td>
                    <td className="px-4 py-3 text-xs text-text-muted text-right whitespace-nowrap">{row.currentEngagement != null ? row.currentEngagement.toFixed(2) + "%" : "—"}</td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap"><span className={row.engagementLift != null && row.engagementLift >= 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>{row.engagementLift != null ? formatPercent(row.engagementLift, 2) : "—"}</span></td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{row.lastSyncAt ? formatDateShort(row.lastSyncAt) : "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${row.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-background-secondary text-text-muted border-border-primary"}`}>{row.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">{row.plan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Data Quality Panel */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1"><AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Data Quality</h3></div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">Data gaps and sync issues that may affect accuracy</p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: "Users without accounts", value: dataQuality.usersWithoutAccounts, total: dataQuality.totalUsers },
            { label: "Accounts without baselines", value: dataQuality.accountsWithoutBaselines, total: dataQuality.totalAccounts },
            { label: "Accounts without recent sync", value: dataQuality.accountsWithoutRecentSync, total: dataQuality.totalAccounts },
            { label: "Accounts without post analytics", value: dataQuality.accountsWithoutPostAnalytics, total: dataQuality.totalAccounts },
            { label: "Stale syncs (>7 days)", value: dataQuality.staleSyncCount, total: dataQuality.totalAccounts },
            { label: "Accounts with valid baselines", value: overview.accountsWithValidBaseline, total: dataQuality.totalAccounts },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-background-secondary/50 border border-border-primary p-3">
              <p className="text-xs text-text-muted">{item.label}</p>
              <p className="text-lg font-bold text-text-primary mt-1">{item.value}<span className="text-sm font-normal text-text-muted"> / {item.total}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Admin Actions */}
      <div className="bg-background-card rounded-xl p-4 sm:p-6 border border-border-primary">
        <div className="flex items-center gap-2 mb-1"><RefreshCw className="h-5 w-5 text-accent-primary shrink-0" /><h3 className="text-base sm:text-lg font-semibold" style={{ fontFamily: "var(--font-serif)" }}>Baseline Management</h3></div>
        <p className="text-xs sm:text-sm text-text-muted mb-4">Backfill missing baselines or recalculate engagement baselines from post analytics data.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleBackfill} disabled={backfillLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent-primary text-white transition-all hover:bg-accent-primary/90 disabled:opacity-50">
            {backfillLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Backfill Missing Baselines
          </button>
          {!showRecalcConfirm ? (
            <button onClick={() => setShowRecalcConfirm(true)} disabled={recalcLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-background-secondary border border-border-primary text-text-primary transition-all hover:bg-background-secondary/80 disabled:opacity-50">
              {recalcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Recalculate Engagement Baselines
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="text-sm text-text-muted">Are you sure? This overwrites all engagement baselines.</span>
              <div className="flex items-center gap-2">
                <button onClick={handleRecalculate} disabled={recalcLoading} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50">
                  {recalcLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm
                </button>
                <button onClick={() => setShowRecalcConfirm(false)} className="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:text-text-primary">Cancel</button>
              </div>
            </div>
          )}
        </div>
        {backfillResult && <p className="mt-3 text-sm text-text-muted">{backfillResult}</p>}
        {recalcResult && <p className="mt-3 text-sm text-text-muted">{recalcResult}</p>}
      </div>
    </div>
  );
}
