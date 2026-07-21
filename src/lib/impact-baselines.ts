import { prisma } from "@/lib/prisma";

export interface BaselineBackfillResult {
  created: number;
  skipped: number;
  missingFollowerStats: number;
  errors: string[];
}

export async function getBaselineForUserPlatform(
  userId: string,
  platform: string
) {
  return prisma.memberGrowthBaseline.findUnique({
    where: { userId_platform: { userId, platform } },
  });
}

export async function ensureBaselineForUserPlatform(
  userId: string,
  platform: string
): Promise<"created" | "skipped" | "missing_data"> {
  const existing = await getBaselineForUserPlatform(userId, platform);
  if (existing) return "skipped";

  const account = await prisma.zernioAccount.findUnique({
    where: { userId_platform: { userId, platform } },
  });
  if (!account) return "missing_data";

  // Find earliest follower stats record for this user/platform
  const earliestFollower = await prisma.followerStats.findFirst({
    where: { userId, platform },
    orderBy: { date: "asc" },
  });

  if (!earliestFollower) return "missing_data";

  // Compute engagement baseline from first 14-30 days of PostAnalytics
  // after the account was connected (or earliest follower date if no connectedAt)
  const baselineDate = earliestFollower.date;
  const windowEnd = new Date(baselineDate);
  windowEnd.setDate(windowEnd.getDate() + 30);

  const earlyPosts = await prisma.postAnalytics.findMany({
    where: {
      userId,
      publishedAt: {
        gte: baselineDate,
        lte: windowEnd,
      },
    },
    select: { views: true, likes: true, comments: true },
  });

  let baselineEngagementRate: number | null = null;
  let baselineAvgViews: number | null = null;
  let baselineAvgInteractions: number | null = null;

  if (earlyPosts.length > 0) {
    const totalViews = earlyPosts.reduce((s, p) => s + p.views, 0);
    const totalInteractions = earlyPosts.reduce(
      (s, p) => s + p.likes + p.comments,
      0
    );
    const postsWithViews = earlyPosts.filter((p) => p.views > 0);

    if (totalViews > 0) {
      baselineEngagementRate = (totalInteractions / totalViews) * 100;
    } else if (postsWithViews.length > 0) {
      const viewSum = postsWithViews.reduce((s, p) => s + p.views, 0);
      const interactionSum = postsWithViews.reduce(
        (s, p) => s + p.likes + p.comments,
        0
      );
      baselineEngagementRate = viewSum > 0 ? (interactionSum / viewSum) * 100 : null;
    }

    baselineAvgViews = totalViews / earlyPosts.length;
    baselineAvgInteractions = totalInteractions / earlyPosts.length;
  }

  await prisma.memberGrowthBaseline.create({
    data: {
      userId,
      platform,
      baselineDate,
      baselineFollowerCount: earliestFollower.followerCount,
      baselineEngagementRate,
      baselineAvgViews,
      baselineAvgInteractions,
    },
  });

  return "created";
}

export async function ensureMemberGrowthBaselines(): Promise<BaselineBackfillResult> {
  const result: BaselineBackfillResult = {
    created: 0,
    skipped: 0,
    missingFollowerStats: 0,
    errors: [],
  };

  const accounts = await prisma.zernioAccount.findMany({
    select: { userId: true, platform: true },
  });

  for (const account of accounts) {
    try {
      const status = await ensureBaselineForUserPlatform(
        account.userId,
        account.platform
      );
      if (status === "created") result.created++;
      else if (status === "skipped") result.skipped++;
      else if (status === "missing_data") result.missingFollowerStats++;
    } catch (err) {
      result.errors.push(
        `${account.userId}/${account.platform}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}

export async function recalculateEngagementBaselines(): Promise<{
  updated: number;
  skipped: number;
  errors: string[];
}> {
  const result = { updated: 0, skipped: 0, errors: [] as string[] };

  const baselines = await prisma.memberGrowthBaseline.findMany({
    select: { id: true, userId: true, platform: true, baselineDate: true },
  });

  for (const baseline of baselines) {
    try {
      const windowEnd = new Date(baseline.baselineDate);
      windowEnd.setDate(windowEnd.getDate() + 30);

      const earlyPosts = await prisma.postAnalytics.findMany({
        where: {
          userId: baseline.userId,
          publishedAt: {
            gte: baseline.baselineDate,
            lte: windowEnd,
          },
        },
        select: { views: true, likes: true, comments: true },
      });

      if (earlyPosts.length === 0) {
        result.skipped++;
        continue;
      }

      const totalViews = earlyPosts.reduce((s, p) => s + p.views, 0);
      const totalInteractions = earlyPosts.reduce(
        (s, p) => s + p.likes + p.comments,
        0
      );

      let engagementRate: number | null = null;
      if (totalViews > 0) {
        engagementRate = (totalInteractions / totalViews) * 100;
      } else {
        const postsWithViews = earlyPosts.filter((p) => p.views > 0);
        if (postsWithViews.length > 0) {
          const viewSum = postsWithViews.reduce((s, p) => s + p.views, 0);
          const interactionSum = postsWithViews.reduce(
            (s, p) => s + p.likes + p.comments,
            0
          );
          engagementRate = viewSum > 0 ? (interactionSum / viewSum) * 100 : null;
        }
      }

      await prisma.memberGrowthBaseline.update({
        where: { id: baseline.id },
        data: {
          baselineEngagementRate: engagementRate,
          baselineAvgViews: totalViews / earlyPosts.length,
          baselineAvgInteractions: totalInteractions / earlyPosts.length,
        },
      });
      result.updated++;
    } catch (err) {
      result.errors.push(
        `${baseline.userId}/${baseline.platform}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return result;
}
