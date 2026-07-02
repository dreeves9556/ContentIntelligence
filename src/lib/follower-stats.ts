export interface FollowerStatsPoint {
  date: string; // ISO date string (YYYY-MM-DD)
  followerCount: number;
  growthDelta: number; // net new followers vs previous day
  growthPercent: number; // percentage growth vs previous day
}

export interface NormalizedFollowerStats {
  points: FollowerStatsPoint[];
}

/**
 * Normalizes an arbitrary Zernio follower-stats API response into a sorted
 * array of daily data points. Handles multiple possible response shapes
 * defensively.
 */
export function normalizeFollowerStatsResponse(raw: unknown, accountId?: string): NormalizedFollowerStats {
  const root = (raw ?? {}) as Record<string, unknown>;
  const points: FollowerStatsPoint[] = [];

  const parsePoint = (entry: Record<string, unknown>): FollowerStatsPoint | null => {
    const date = String(
      entry.date ?? entry.day ?? entry.timestamp ?? entry.createdAt ?? ""
    );
    if (!date) return null;

    const followerCount = Number(
      entry.followers ?? entry.followerCount ?? entry.followersCount ?? entry.count ?? 0
    );
    const growthDelta = Number(
      entry.growth ?? entry.delta ?? entry.growthDelta ?? entry.netNew ?? 0
    );
    const growthPercent = Number(
      entry.growthPercent ??
        entry.growthPercentage ??
        entry.percentGrowth ??
        entry.growthRate ??
        0
    );

    return {
      date: date.split("T")[0], // strip time portion if present
      followerCount,
      growthDelta,
      growthPercent,
    };
  };

  // Shape 1: { stats: [{date, followers, growth, growthPercent}, ...] }
  const statsArr = root.stats ?? root.history ?? root.data ?? root.points;
  if (Array.isArray(statsArr)) {
    for (const entry of statsArr as Record<string, unknown>[]) {
      const point = parsePoint(entry);
      if (point) points.push(point);
    }
  }

  // Shape 2: { followerStats: { "2025-06-01": {followers, growth, ...}, ... } }
  const map = root.followerStats ?? root.byDate;
  if (map && typeof map === "object" && !Array.isArray(map)) {
    for (const [dateKey, val] of Object.entries(map as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const point = parsePoint({ ...(val as Record<string, unknown>), date: dateKey });
        if (point) points.push(point);
      }
    }
  }

  // Shape 3 (Zernio actual): { stats: { "accountId": [{date, followers}, ...], ... } }
  // stats is an object keyed by accountId, each value is an array of daily points
  if (root.stats && typeof root.stats === "object" && !Array.isArray(root.stats)) {
    const statsObj = root.stats as Record<string, unknown>;
    const entries = accountId && statsObj[accountId]
      ? [[accountId, statsObj[accountId]] as [string, unknown]]
      : Object.entries(statsObj);
    for (const [, val] of entries) {
      if (Array.isArray(val)) {
        for (const entry of val as Record<string, unknown>[]) {
          const point = parsePoint(entry);
          if (point) points.push(point);
        }
      }
    }
  }

  // Deduplicate by date (keep last occurrence) and sort ascending
  const byDate = new Map<string, FollowerStatsPoint>();
  for (const p of points) {
    byDate.set(p.date, p);
  }

  const sorted = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // Compute growthDelta and growthPercent from consecutive points if they're zero
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].growthDelta === 0 && sorted[i].growthPercent === 0 && i > 0) {
      const prev = sorted[i - 1];
      sorted[i].growthDelta = sorted[i].followerCount - prev.followerCount;
      sorted[i].growthPercent =
        prev.followerCount > 0
          ? ((sorted[i].growthDelta / prev.followerCount) * 100)
          : 0;
    }
  }

  return { points: sorted };
}

/**
 * Computes a human-readable summary of follower growth for the AI insight prompt.
 * Returns a string like:
 *   "Instagram: 1,250 followers (+50 this week, +4.2% growth)"
 */
export function summarizeFollowerGrowth(
  points: FollowerStatsPoint[],
  platformLabel: string
): string {
  if (points.length === 0) return "";

  const latest = points[points.length - 1];
  const weekAgoIdx = Math.max(0, points.length - 8);
  const weekAgo = points[weekAgoIdx];

  const weeklyDelta = latest.followerCount - weekAgo.followerCount;
  const weeklyPercent =
    weekAgo.followerCount > 0
      ? ((weeklyDelta / weekAgo.followerCount) * 100).toFixed(1)
      : "0";

  const sign = weeklyDelta >= 0 ? "+" : "";
  return `${platformLabel}: ${latest.followerCount.toLocaleString()} followers (${sign}${weeklyDelta} this week, ${sign}${weeklyPercent}% growth)`;
}
