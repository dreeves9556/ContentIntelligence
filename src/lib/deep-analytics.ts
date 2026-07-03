import type { DeepAnalyticsEndpoint } from "@/lib/zernio";

// ─── Normalized Types ──────────────────────────────────────────────

export interface DemographicsBreakdown {
  age: { range: string; percent: number }[];
  gender: { label: string; percent: number }[];
}

export interface RetentionCurvePoint {
  time: number; // seconds
  percent: number; // 0-100
}

export interface RetentionCurve {
  points: RetentionCurvePoint[];
  avgViewDuration?: number; // seconds
  avgViewDurationPercent?: number; // 0-100
}

export interface DailyViewsPoint {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface DailyViews {
  points: DailyViewsPoint[];
}

export interface AccountInsights {
  metrics: { label: string; value: number }[];
}

export interface ChannelInsights {
  metrics: { label: string; value: number }[];
}

export interface PostReactions {
  reactions: { type: string; count: number }[];
}

export interface PageInsights {
  metrics: { label: string; value: number }[];
}

export interface ContentDecayBucket {
  order: number;
  label: string;
  pctOfFinal: number;
  postCount: number;
}

export interface ContentDecay {
  buckets: ContentDecayBucket[];
}

export interface DailyMetricsPoint {
  date: string;
  postCount: number;
  metrics: { impressions: number; reach: number; likes: number; comments: number; shares: number; saves: number; clicks: number; views: number };
}

export interface DailyMetrics {
  points: DailyMetricsPoint[];
}

export interface PostingFrequencyRow {
  platform: string;
  postsPerWeek: number;
  avgEngagementRate: number;
  avgEngagement: number;
  weeksCount: number;
}

export interface PostingFrequency {
  rows: PostingFrequencyRow[];
}

export type DeepAnalyticsData =
  | { kind: "demographics"; payload: DemographicsBreakdown }
  | { kind: "retention"; payload: RetentionCurve }
  | { kind: "dailyViews"; payload: DailyViews }
  | { kind: "accountInsights"; payload: AccountInsights }
  | { kind: "channelInsights"; payload: ChannelInsights }
  | { kind: "postReactions"; payload: PostReactions }
  | { kind: "pageInsights"; payload: PageInsights }
  | { kind: "contentDecay"; payload: ContentDecay }
  | { kind: "dailyMetrics"; payload: DailyMetrics }
  | { kind: "postingFrequency"; payload: PostingFrequency };

// ─── Helpers ───────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function pct(v: unknown): number {
  const n = num(v);
  if (n > 1 && n <= 100) return n; // already percentage
  if (n > 0 && n <= 1) return n * 100; // fraction → percentage
  return n;
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return [];
}

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  return {};
}

// ─── Demographics Normalizer ───────────────────────────────────────

export function normalizeDemographics(raw: unknown): DemographicsBreakdown {
  const root = asObj(raw);
  const demoRoot = asObj(root.demographics).age ? asObj(root.demographics) : root;
  const age: { range: string; percent: number }[] = [];
  const gender: { label: string; percent: number }[] = [];

  // Try various possible shapes for age data
  const ageData =
    demoRoot.age ?? demoRoot.ages ?? demoRoot.ageDistribution ?? demoRoot.ageRange;
  if (Array.isArray(ageData)) {
    const total = ageData.reduce((s: number, e: unknown) => s + num(asObj(e).value), 0);
    for (const entry of ageData as Record<string, unknown>[]) {
      const range = String(entry.dimension ?? entry.range ?? entry.age ?? entry.ageRange ?? entry.label ?? entry.key ?? "");
      const rawVal = num(entry.value ?? entry.percent ?? entry.percentage ?? entry.share ?? 0);
      const value = total > 0 && rawVal <= total ? (rawVal / total) * 100 : pct(rawVal);
      if (range) age.push({ range, percent: value });
    }
  } else if (ageData && typeof ageData === "object") {
    for (const [key, val] of Object.entries(ageData as Record<string, unknown>)) {
      age.push({ range: key, percent: pct(val) });
    }
  }

  // Try various possible shapes for gender data
  const genderData =
    demoRoot.gender ?? demoRoot.genders ?? demoRoot.genderDistribution;
  if (Array.isArray(genderData)) {
    const total = genderData.reduce((s: number, e: unknown) => s + num(asObj(e).value), 0);
    for (const entry of genderData as Record<string, unknown>[]) {
      const label = String(entry.dimension ?? entry.label ?? entry.gender ?? entry.type ?? entry.key ?? "");
      const rawVal = num(entry.value ?? entry.percent ?? entry.percentage ?? entry.share ?? 0);
      const value = total > 0 && rawVal <= total ? (rawVal / total) * 100 : pct(rawVal);
      if (label) gender.push({ label, percent: value });
    }
  } else if (genderData && typeof genderData === "object") {
    for (const [key, val] of Object.entries(genderData as Record<string, unknown>)) {
      gender.push({ label: key, percent: pct(val) });
    }
  }

  return { age, gender };
}

// ─── Retention Curve Normalizer ────────────────────────────────────

export function normalizeRetention(raw: unknown): RetentionCurve {
  const root = asObj(raw);
  const points: RetentionCurvePoint[] = [];

  const curveData =
    root.retentionCurve ?? root.retention ?? root.curve ?? root.points ?? root.data;
  if (Array.isArray(curveData)) {
    for (const entry of curveData as Record<string, unknown>[]) {
      const time = num(entry.time ?? entry.timestamp ?? entry.second ?? entry.seconds ?? entry.elapsed ?? 0);
      const value = pct(entry.percent ?? entry.percentage ?? entry.retention ?? entry.value ?? 0);
      points.push({ time, percent: value });
    }
  } else if (curveData && typeof curveData === "object") {
    for (const [key, val] of Object.entries(curveData as Record<string, unknown>)) {
      const time = num(key);
      if (Number.isFinite(time)) {
        const entry = asObj(val);
        points.push({
          time,
          percent: pct(entry.percent ?? entry.percentage ?? entry.retention ?? val ?? 0),
        });
      }
    }
  }

  points.sort((a, b) => a.time - b.time);

  const avgViewDuration = num(root.avgViewDuration ?? root.averageViewDuration ?? root.avgWatchTime ?? 0);
  const avgViewDurationPercent = pct(root.avgViewDurationPercent ?? root.averageViewDurationPercentage ?? 0);

  return {
    points,
    ...(avgViewDuration > 0 && { avgViewDuration }),
    ...(avgViewDurationPercent > 0 && { avgViewDurationPercent }),
  };
}

// ─── Daily Views Normalizer ────────────────────────────────────────

export function normalizeDailyViews(raw: unknown): DailyViews {
  const root = asObj(raw);
  const points: DailyViewsPoint[] = [];

  const viewsData = root.views ?? root.dailyViews ?? root.data ?? root.points ?? root.stats;
  if (Array.isArray(viewsData)) {
    for (const entry of viewsData as Record<string, unknown>[]) {
      const date = String(entry.date ?? entry.day ?? entry.timestamp ?? "").split("T")[0];
      const views = num(entry.views ?? entry.viewCount ?? entry.value ?? 0);
      if (date) points.push({ date, views });
    }
  } else if (viewsData && typeof viewsData === "object") {
    for (const [dateKey, val] of Object.entries(viewsData as Record<string, unknown>)) {
      const date = dateKey.split("T")[0];
      const views = num(asObj(val).views ?? val ?? 0);
      points.push({ date, views });
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return { points };
}

// ─── Generic Metrics Normalizer ────────────────────────────────────

export function normalizeMetricsList(raw: unknown, fieldHints: string[]): AccountInsights {
  const root = asObj(raw);
  const metrics: { label: string; value: number }[] = [];

  // Zernio format: root.metrics = { metricName: { total: N }, ... }
  const metricsObj = asObj(root.metrics);
  if (Object.keys(metricsObj).length > 0) {
    for (const [key, val] of Object.entries(metricsObj)) {
      const obj = asObj(val);
      const value = num(obj.total ?? obj.value ?? obj.count ?? (typeof val === "number" ? val : 0));
      if (value > 0) metrics.push({ label: humanizeLabel(key), value });
    }
  }

  // Fallback: check root directly for hinted fields
  for (const hint of fieldHints) {
    const val = root[hint];
    if (val !== undefined && val !== null) {
      if (typeof val === "number" || typeof val === "string") {
        metrics.push({ label: humanizeLabel(hint), value: num(val) });
      } else if (typeof val === "object") {
        const obj = asObj(val);
        const value = num(obj.value ?? obj.count ?? obj.total ?? 0);
        if (value > 0 || obj.value !== undefined) {
          metrics.push({ label: humanizeLabel(hint), value });
        }
      }
    }
  }

  // Also check for a metrics array
  const metricsArr = root.data ?? root.stats;
  if (Array.isArray(metricsArr)) {
    for (const entry of metricsArr as Record<string, unknown>[]) {
      const label = String(entry.label ?? entry.name ?? entry.metric ?? entry.key ?? "");
      const value = num(entry.value ?? entry.count ?? entry.total ?? 0);
      if (label) metrics.push({ label, value });
    }
  }

  return { metrics };
}

export function normalizeContentDecay(raw: unknown): ContentDecay {
  const root = asObj(raw);
  const buckets: ContentDecayBucket[] = [];

  const rawBuckets = root.buckets ?? root.data;
  if (Array.isArray(rawBuckets)) {
    for (const entry of rawBuckets as Record<string, unknown>[]) {
      buckets.push({
        order: num(entry.bucket_order ?? entry.order ?? 0),
        label: String(entry.bucket_label ?? entry.label ?? ""),
        pctOfFinal: num(entry.avg_pct_of_final ?? entry.pctOfFinal ?? 0),
        postCount: num(entry.post_count ?? entry.postCount ?? 0),
      });
    }
  }

  buckets.sort((a, b) => a.order - b.order);
  return { buckets };
}

export function normalizeDailyMetrics(raw: unknown): DailyMetrics {
  const root = asObj(raw);
  const points: DailyMetricsPoint[] = [];

  const dailyData = root.dailyData ?? root.data ?? root.points;
  if (Array.isArray(dailyData)) {
    for (const entry of dailyData as Record<string, unknown>[]) {
      const date = String(entry.date ?? entry.day ?? "").split("T")[0];
      const m = asObj(entry.metrics);
      if (date) {
        points.push({
          date,
          postCount: num(entry.postCount ?? 0),
          metrics: {
            impressions: num(m.impressions ?? 0),
            reach: num(m.reach ?? 0),
            likes: num(m.likes ?? 0),
            comments: num(m.comments ?? 0),
            shares: num(m.shares ?? 0),
            saves: num(m.saves ?? 0),
            clicks: num(m.clicks ?? 0),
            views: num(m.views ?? 0),
          },
        });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return { points };
}

export function normalizePostingFrequency(raw: unknown): PostingFrequency {
  const root = asObj(raw);
  const rows: PostingFrequencyRow[] = [];

  const freqData = root.frequency ?? root.data ?? root.rows;
  if (Array.isArray(freqData)) {
    for (const entry of freqData as Record<string, unknown>[]) {
      rows.push({
        platform: String(entry.platform ?? ""),
        postsPerWeek: num(entry.posts_per_week ?? entry.postsPerWeek ?? 0),
        avgEngagementRate: num(entry.avg_engagement_rate ?? entry.avgEngagementRate ?? 0),
        avgEngagement: num(entry.avg_engagement ?? entry.avgEngagement ?? 0),
        weeksCount: num(entry.weeks_count ?? entry.weeksCount ?? 0),
      });
    }
  }

  return { rows };
}

export function normalizePostReactions(raw: unknown): PostReactions {
  const root = asObj(raw);
  const reactions: { type: string; count: number }[] = [];

  const reactionsData = root.reactions ?? root.data ?? root.postReactions ?? root.stats;
  if (Array.isArray(reactionsData)) {
    for (const entry of reactionsData as Record<string, unknown>[]) {
      const type = String(entry.type ?? entry.reaction ?? entry.label ?? entry.key ?? "");
      const count = num(entry.count ?? entry.value ?? entry.total ?? 0);
      if (type) reactions.push({ type, count });
    }
  } else if (reactionsData && typeof reactionsData === "object") {
    for (const [key, val] of Object.entries(reactionsData as Record<string, unknown>)) {
      reactions.push({ type: key, count: num(val) });
    }
  }

  return { reactions };
}

// ─── Label Helpers ─────────────────────────────────────────────────

function humanizeLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

// ─── Endpoint → DataType Mapping ───────────────────────────────────

export interface PlatformEndpointConfig {
  endpoint: DeepAnalyticsEndpoint;
  dataType: string;
  normalize: (raw: unknown) => DeepAnalyticsData;
  useAccountPath?: boolean;
}

export const PLATFORM_DEEP_ANALYTICS: Record<string, PlatformEndpointConfig[]> = {
  instagram: [
    { endpoint: "instagram/demographics", dataType: "demographics", normalize: (r) => ({ kind: "demographics", payload: normalizeDemographics(r) }) },
    { endpoint: "instagram/account-insights", dataType: "account_insights", normalize: (r) => ({ kind: "accountInsights", payload: normalizeMetricsList(r, ["impressions", "reach", "profileViews", "websiteClicks", "followerCount"]) }) },
  ],
  youtube: [
    { endpoint: "youtube/demographics", dataType: "demographics", normalize: (r) => ({ kind: "demographics", payload: normalizeDemographics(r) }) },
    { endpoint: "youtube/channel-insights", dataType: "channel_insights", normalize: (r) => ({ kind: "channelInsights", payload: normalizeMetricsList(r, ["views", "subscribers", "watchTime", "estimatedRevenue", "impressions", "clickThroughRate"]) }) },
  ],
  tiktok: [
    { endpoint: "tiktok/account-insights", dataType: "account_insights", normalize: (r) => ({ kind: "accountInsights", payload: normalizeMetricsList(r, ["views", "likes", "shares", "comments", "followers", "profileViews", "videoViews"]) }) },
  ],
  linkedin: [
    { endpoint: "linkedin/org-aggregate-analytics", dataType: "aggregate", normalize: (r) => ({ kind: "accountInsights", payload: normalizeMetricsList(r, ["impressions", "clicks", "engagementRate", "likes", "comments", "shares", "follows"]) }) },
  ],
  facebook: [
    { endpoint: "facebook/page-insights", dataType: "page_insights", normalize: (r) => ({ kind: "pageInsights", payload: normalizeMetricsList(r, ["pageViews", "pageLikes", "postReach", "postEngagement", "impressions", "clicks"]) }) },
  ],
};

// ─── AI Prompt Summary ─────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  facebook: "Facebook",
};

export function summarizeDemographicsForAI(
  rows: { platform: string; data: unknown }[]
): string {
  const lines: string[] = [];

  for (const row of rows) {
    if (row.data === null || typeof row.data !== "object") continue;
    const data = row.data as { kind?: string; payload?: DemographicsBreakdown };
    if (data.kind !== "demographics" || !data.payload) continue;

    const demo = data.payload;
    const label = PLATFORM_LABELS[row.platform.toLowerCase()] ?? row.platform;

    const ageParts = demo.age
      .filter((a) => a.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 3)
      .map((a) => `${a.percent.toFixed(0)}% aged ${a.range}`);

    const genderParts = demo.gender
      .filter((g) => g.percent > 0)
      .sort((a, b) => b.percent - a.percent)
      .map((g) => `${g.percent.toFixed(0)}% ${g.label}`);

    if (ageParts.length > 0 || genderParts.length > 0) {
      const parts = [...genderParts, ...ageParts];
      lines.push(`${label}: ${parts.join(", ")}`);
    }
  }

  if (lines.length === 0) return "";
  return lines.join("\n");
}
