export interface EngagementPost {
  views: number;
  likes: number;
  comments: number;
}

export function computeWeightedEngagementRate(
  posts: EngagementPost[]
): number | null {
  const postsWithViews = posts.filter((post) => post.views > 0);
  if (postsWithViews.length === 0) return null;

  const totalViews = postsWithViews.reduce((sum, post) => sum + post.views, 0);
  const totalInteractions = postsWithViews.reduce(
    (sum, post) => sum + post.likes + post.comments,
    0
  );

  return totalViews > 0 ? (totalInteractions / totalViews) * 100 : null;
}

export function utcStartOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

export interface FollowerObservation {
  userId: string;
  platform: string;
  date: Date;
  followerCount: number;
}

export function accountKey(userId: string, platform: string): string {
  return `${userId}|${platform.toLowerCase()}`;
}

/**
 * Flags two platform histories for the same user when their three most recent
 * overlapping snapshots are identical. Separate social platforms should not
 * produce the same non-zero follower series day after day; this catches the
 * cross-account response blending that previously corrupted the dashboard.
 */
export function findDuplicatedFollowerSeries(
  observations: FollowerObservation[]
): Set<string> {
  const byUserPlatform = new Map<string, Map<string, number>>();

  for (const observation of observations) {
    const key = accountKey(observation.userId, observation.platform);
    const series = byUserPlatform.get(key) ?? new Map<string, number>();
    series.set(observation.date.toISOString().slice(0, 10), observation.followerCount);
    byUserPlatform.set(key, series);
  }

  const keysByUser = new Map<string, string[]>();
  for (const key of byUserPlatform.keys()) {
    const userId = key.slice(0, key.indexOf("|"));
    keysByUser.set(userId, [...(keysByUser.get(userId) ?? []), key]);
  }

  const suspicious = new Set<string>();
  for (const keys of keysByUser.values()) {
    for (let leftIndex = 0; leftIndex < keys.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex++) {
        const left = byUserPlatform.get(keys[leftIndex])!;
        const right = byUserPlatform.get(keys[rightIndex])!;
        const overlappingDates = [...left.keys()]
          .filter((date) => right.has(date))
          .sort()
          .slice(-3);

        if (
          overlappingDates.length === 3 &&
          overlappingDates.some((date) => (left.get(date) ?? 0) > 0) &&
          overlappingDates.every((date) => left.get(date) === right.get(date))
        ) {
          suspicious.add(keys[leftIndex]);
          suspicious.add(keys[rightIndex]);
        }
      }
    }
  }

  return suspicious;
}
