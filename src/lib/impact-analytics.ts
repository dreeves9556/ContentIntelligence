import { prisma } from "@/lib/prisma";
import {
  accountKey,
  computeWeightedEngagementRate,
  findDuplicatedFollowerSeries,
  utcStartOfDay,
} from "@/lib/impact-math";

export interface ImpactOverview {
  connectedMembers: number;
  connectedAccounts: number;
  totalFollowersGained: number;
  avgFollowerGrowth: number;
  avgEngagementLift: number;
  totalViewsTracked: number;
  totalPostsTracked: number;
  activeUsers: number;
  accountsWithValidBaseline: number;
  accountsWithValidEngagement: number;
  accountsMissingBaseline: number;
}

export interface ImpactTimeSeriesPoint {
  date: string;
  totalFollowers: number;
}

export interface EngagementTimeSeriesPoint {
  week: string;
  engagementRate: number;
  totalViews: number;
  totalInteractions: number;
}

export interface MemberGrowthRow {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  platform: string;
  handle: string | null;
  baselineDate: string | null;
  baselineFollowers: number | null;
  currentFollowers: number | null;
  followersGained: number | null;
  growthPercent: number | null;
  baselineEngagement: number | null;
  currentEngagement: number | null;
  engagementLift: number | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  accountStatus: string;
  plan: string;
  organizationName: string | null;
  isActive: boolean;
  followerDataValid: boolean;
}

export interface PlatformGrowthBreakdownRow {
  platform: string;
  followersGained: number;
  avgGrowthPercent: number;
  accountCount: number;
}

export interface CohortGrowthRow {
  cohort: string;
  accountCount: number;
  avgGrowthPercent: number;
  avgEngagementLift: number;
}

export interface UsageCorrelationStats {
  activeUsers: number;
  inactiveUsers: number;
  activeAvgGrowth: number;
  inactiveAvgGrowth: number;
  activeAvgEngagement: number;
  inactiveAvgEngagement: number;
  activeAvgPosts: number;
  inactiveAvgPosts: number;
}

export interface DataQualityStats {
  usersWithoutAccounts: number;
  accountsWithoutBaselines: number;
  accountsWithoutRecentSync: number;
  accountsWithoutPostAnalytics: number;
  staleSyncCount: number;
  suspiciousFollowerAccounts: number;
  totalUsers: number;
  totalAccounts: number;
}

const STALE_SYNC_DAYS = 7;
const ACTIVE_DAYS = 30;
const IMPACT_ACCOUNT_STATUSES = ["ACTIVE", "TRIAL", "COMPED"] as const;

async function getImpactAccounts() {
  return prisma.zernioAccount.findMany({
    where: {
      user: {
        role: { not: "ADMIN" },
        accountStatus: { in: [...IMPACT_ACCOUNT_STATUSES] },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          organization: { select: { name: true } },
        },
      },
    },
  });
}

function baselineStartsAfterConnection(
  baselineDate: Date,
  connectedAt: Date
): boolean {
  return baselineDate >= utcStartOfDay(connectedAt);
}

function postsForAccount<T extends { userId: string; platform: string | null }>(
  posts: T[],
  userId: string,
  platform: string
): T[] {
  const key = accountKey(userId, platform);
  return posts.filter(
    (post) =>
      post.platform != null && accountKey(post.userId, post.platform) === key
  );
}

export async function getImpactOverview(): Promise<ImpactOverview> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_DAYS);

  const accounts = await getImpactAccounts();
  const connectedUserIds = [...new Set(accounts.map((account) => account.userId))];
  const connectedAccountKeys = new Set(
    accounts.map((account) => accountKey(account.userId, account.platform))
  );

  const [allBaselines, allFollowerStats, allPosts, activeCalendarUsers] =
    await Promise.all([
    prisma.memberGrowthBaseline.findMany({
      where: { userId: { in: connectedUserIds } },
    }),
    prisma.followerStats.findMany({
      where: { userId: { in: connectedUserIds } },
      orderBy: { date: "desc" },
      select: { userId: true, platform: true, followerCount: true, date: true },
    }),
    prisma.postAnalytics.findMany({
      where: {
        userId: { in: connectedUserIds },
        isDemo: false,
        platform: { not: null },
      },
      select: {
        userId: true,
        platform: true,
        publishedAt: true,
        views: true,
        likes: true,
        comments: true,
      },
    }),
    prisma.calendar.findMany({
      where: {
        userId: { in: connectedUserIds },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const connectedMembers = connectedUserIds.length;
  const connectedAccounts = accounts.length;
  const followerStats = allFollowerStats.filter((stat) =>
    connectedAccountKeys.has(accountKey(stat.userId, stat.platform))
  );
  const suspiciousFollowerAccounts = findDuplicatedFollowerSeries(followerStats);
  const posts = allPosts.filter(
    (post) =>
      post.platform != null &&
      connectedAccountKeys.has(accountKey(post.userId, post.platform))
  );

  const latestByAccount = new Map<string, number>();
  for (const fs of followerStats) {
    const key = accountKey(fs.userId, fs.platform);
    if (!latestByAccount.has(key)) {
      latestByAccount.set(key, fs.followerCount);
    }
  }

  let totalFollowersGained = 0;
  const growthByMember = new Map<string, { baseline: number; current: number }>();
  let accountsWithValidBaseline = 0;
  let accountsMissingBaseline = 0;

  for (const account of accounts) {
    const baseline = allBaselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    const key = accountKey(account.userId, account.platform);
    const current = latestByAccount.get(key);

    if (
      !baseline ||
      baseline.baselineFollowerCount == null ||
      !baselineStartsAfterConnection(baseline.baselineDate, account.connectedAt) ||
      suspiciousFollowerAccounts.has(key)
    ) {
      accountsMissingBaseline++;
      continue;
    }

    if (current == null) continue;

    const gained = current - baseline.baselineFollowerCount;
    totalFollowersGained += gained;
    accountsWithValidBaseline++;

    if (baseline.baselineFollowerCount > 0) {
      const member = growthByMember.get(account.userId) ?? {
        baseline: 0,
        current: 0,
      };
      member.baseline += baseline.baselineFollowerCount;
      member.current += current;
      growthByMember.set(account.userId, member);
    }
  }

  const growthPercents = [...growthByMember.values()].map(
    (member) => ((member.current - member.baseline) / member.baseline) * 100
  );
  const avgFollowerGrowth =
    growthPercents.length > 0
      ? growthPercents.reduce((s, v) => s + v, 0) / growthPercents.length
      : 0;

  const engagementLiftsByMember = new Map<string, number[]>();
  let accountsWithValidEngagement = 0;

  for (const account of accounts) {
    const baseline = allBaselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    if (
      !baseline ||
      !baselineStartsAfterConnection(baseline.baselineDate, account.connectedAt)
    ) continue;

    const accountPosts = postsForAccount(posts, account.userId, account.platform);
    const baselineEnd = new Date(baseline.baselineDate);
    baselineEnd.setDate(baselineEnd.getDate() + 30);
    const baselineEngagement = computeWeightedEngagementRate(
      accountPosts.filter(
        (post) =>
          post.publishedAt >= baseline.baselineDate &&
          post.publishedAt <= baselineEnd
      )
    );
    const recentPosts = accountPosts.filter(
      (post) => post.publishedAt >= thirtyDaysAgo
    );

    const currentEngagement = computeWeightedEngagementRate(recentPosts);
    if (currentEngagement != null && baselineEngagement != null) {
      accountsWithValidEngagement++;
      const memberLifts = engagementLiftsByMember.get(account.userId) ?? [];
      memberLifts.push(currentEngagement - baselineEngagement);
      engagementLiftsByMember.set(account.userId, memberLifts);
    }
  }

  const engagementLifts = [...engagementLiftsByMember.values()].map(
    (lifts) => lifts.reduce((sum, lift) => sum + lift, 0) / lifts.length
  );
  const avgEngagementLift =
    engagementLifts.length > 0
      ? engagementLifts.reduce((s, v) => s + v, 0) / engagementLifts.length
      : 0;

  const activeUserIds = new Set([
    ...activeCalendarUsers.map((u) => u.userId),
    ...accounts
      .filter(
        (account) =>
          account.lastSyncAt != null && account.lastSyncAt >= thirtyDaysAgo
      )
      .map((account) => account.userId),
  ]);

  return {
    connectedMembers,
    connectedAccounts,
    totalFollowersGained,
    avgFollowerGrowth,
    avgEngagementLift,
    totalViewsTracked: posts.reduce((sum, post) => sum + post.views, 0),
    totalPostsTracked: posts.length,
    activeUsers: activeUserIds.size,
    accountsWithValidBaseline,
    accountsWithValidEngagement,
    accountsMissingBaseline,
  };
}

export async function getImpactTimeSeries(): Promise<ImpactTimeSeriesPoint[]> {
  const accounts = await getImpactAccounts();
  const accountKeys = new Set(
    accounts.map((account) => accountKey(account.userId, account.platform))
  );
  const allFollowerStats = await prisma.followerStats.findMany({
    where: { userId: { in: [...new Set(accounts.map((a) => a.userId))] } },
    orderBy: { date: "asc" },
    select: { date: true, followerCount: true, userId: true, platform: true },
  });
  const followerStats = allFollowerStats.filter((stat) =>
    accountKeys.has(accountKey(stat.userId, stat.platform))
  );
  const suspicious = findDuplicatedFollowerSeries(followerStats);

  const statsByDate = new Map<string, typeof followerStats>();
  for (const stat of followerStats) {
    const key = accountKey(stat.userId, stat.platform);
    if (suspicious.has(key)) continue;
    const dateKey = stat.date.toISOString().split("T")[0];
    statsByDate.set(dateKey, [...(statsByDate.get(dateKey) ?? []), stat]);
  }

  const latestPerAccount = new Map<string, number>();
  const result: ImpactTimeSeriesPoint[] = [];
  for (const dateKey of [...statsByDate.keys()].sort()) {
    for (const stat of statsByDate.get(dateKey) ?? []) {
      latestPerAccount.set(
        accountKey(stat.userId, stat.platform),
        stat.followerCount
      );
    }
    result.push({
      date: dateKey,
      totalFollowers: [...latestPerAccount.values()].reduce(
        (sum, count) => sum + count,
        0
      ),
    });
  }

  return result;
}

export async function getEngagementTimeSeries(): Promise<EngagementTimeSeriesPoint[]> {
  const accounts = await getImpactAccounts();
  const accountKeys = new Set(
    accounts.map((account) => accountKey(account.userId, account.platform))
  );
  const allPosts = await prisma.postAnalytics.findMany({
    where: {
      userId: { in: [...new Set(accounts.map((account) => account.userId))] },
      isDemo: false,
      platform: { not: null },
    },
    orderBy: { publishedAt: "asc" },
    select: {
      userId: true,
      platform: true,
      publishedAt: true,
      views: true,
      likes: true,
      comments: true,
    },
  });
  const posts = allPosts.filter(
    (post) =>
      post.platform != null &&
      accountKeys.has(accountKey(post.userId, post.platform))
  );

  const weekMap = new Map<string, { views: number; interactions: number }>();

  for (const post of posts) {
    if (post.views <= 0) continue;
    const date = new Date(post.publishedAt);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split("T")[0];

    const existing = weekMap.get(weekKey) ?? { views: 0, interactions: 0 };
    existing.views += post.views;
    existing.interactions += post.likes + post.comments;
    weekMap.set(weekKey, existing);
  }

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, data]) => ({
      week,
      engagementRate: data.views > 0 ? (data.interactions / data.views) * 100 : 0,
      totalViews: data.views,
      totalInteractions: data.interactions,
    }));
}

export async function getMemberGrowthRows(): Promise<MemberGrowthRow[]> {
  const accounts = await getImpactAccounts();
  const connectedUserIds = [...new Set(accounts.map((account) => account.userId))];
  const connectedAccountKeys = new Set(
    accounts.map((account) => accountKey(account.userId, account.platform))
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_DAYS);

  const [baselines, allFollowerStats, allPosts, recentCalendars] =
    await Promise.all([
      prisma.memberGrowthBaseline.findMany({
        where: { userId: { in: connectedUserIds } },
      }),
      prisma.followerStats.findMany({
        where: { userId: { in: connectedUserIds } },
        orderBy: { date: "desc" },
        select: { userId: true, platform: true, followerCount: true, date: true },
      }),
      prisma.postAnalytics.findMany({
        where: {
          userId: { in: connectedUserIds },
          isDemo: false,
          platform: { not: null },
        },
        select: {
          userId: true,
          platform: true,
          publishedAt: true,
          views: true,
          likes: true,
          comments: true,
        },
      }),
      prisma.calendar.findMany({
        where: {
          userId: { in: connectedUserIds },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { userId: true },
        distinct: ["userId"],
      }),
    ]);
  const followerStats = allFollowerStats.filter((stat) =>
    connectedAccountKeys.has(accountKey(stat.userId, stat.platform))
  );
  const suspiciousFollowerAccounts = findDuplicatedFollowerSeries(followerStats);
  const posts = allPosts.filter(
    (post) =>
      post.platform != null &&
      connectedAccountKeys.has(accountKey(post.userId, post.platform))
  );

  const latestFollowerMap = new Map<string, number>();
  for (const fs of followerStats) {
    const key = accountKey(fs.userId, fs.platform);
    if (!latestFollowerMap.has(key)) {
      latestFollowerMap.set(key, fs.followerCount);
    }
  }

  const activeCalendarUserIds = new Set(recentCalendars.map((c) => c.userId));
  const activeSyncUserIds = new Set(
    accounts
      .filter(
        (account) =>
          account.lastSyncAt != null && account.lastSyncAt >= thirtyDaysAgo
      )
      .map((account) => account.userId)
  );

  const rows: MemberGrowthRow[] = [];

  for (const account of accounts) {
    const baseline = baselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    const key = accountKey(account.userId, account.platform);
    const followerDataValid = !suspiciousFollowerAccounts.has(key);
    const baselineIsValid =
      baseline != null &&
      baselineStartsAfterConnection(baseline.baselineDate, account.connectedAt);
    const currentFollowers = followerDataValid
      ? latestFollowerMap.get(key)
      : undefined;

    const baselineFollowers =
      followerDataValid && baselineIsValid
        ? baseline.baselineFollowerCount
        : null;
    const followersGained =
      baselineFollowers != null && currentFollowers != null
        ? currentFollowers - baselineFollowers
        : null;
    const growthPercent =
      followersGained != null && baselineFollowers != null && baselineFollowers > 0
        ? (followersGained / baselineFollowers) * 100
        : null;

    const accountPosts = postsForAccount(posts, account.userId, account.platform);
    const recentPosts = accountPosts.filter(
      (post) => post.publishedAt >= thirtyDaysAgo
    );
    const currentEngagement = computeWeightedEngagementRate(recentPosts);

    let baselineEngagement: number | null = null;
    if (baselineIsValid) {
      const baselineEnd = new Date(baseline.baselineDate);
      baselineEnd.setDate(baselineEnd.getDate() + 30);
      baselineEngagement = computeWeightedEngagementRate(
        accountPosts.filter(
          (post) =>
            post.publishedAt >= baseline.baselineDate &&
            post.publishedAt <= baselineEnd
        )
      );
    }
    const engagementLift =
      baselineEngagement != null && currentEngagement != null
        ? currentEngagement - baselineEngagement
        : null;

    const isActive =
      activeCalendarUserIds.has(account.userId) ||
      activeSyncUserIds.has(account.userId);

    const lastSyncAt = account.lastSyncAt;
    const isStale =
      !lastSyncAt ||
      (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60 * 24) > STALE_SYNC_DAYS;

    rows.push({
      userId: account.userId,
      userName: account.user.name,
      userEmail: account.user.email,
      platform: account.platform,
      handle: account.handle,
      baselineDate: baselineIsValid ? baseline.baselineDate.toISOString() : null,
      baselineFollowers,
      currentFollowers: currentFollowers ?? null,
      followersGained,
      growthPercent,
      baselineEngagement,
      currentEngagement,
      engagementLift,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
      connectedAt: account.connectedAt.toISOString(),
      accountStatus: isStale ? "STALE" : "ACTIVE",
      plan: account.user.plan ?? "PRO",
      organizationName: account.user.organization?.name ?? null,
      isActive,
      followerDataValid,
    });
  }

  return rows;
}

export async function getPlatformGrowthBreakdown(
  providedRows?: MemberGrowthRow[]
): Promise<PlatformGrowthBreakdownRow[]> {
  const rows = providedRows ?? (await getMemberGrowthRows());

  const byPlatform = new Map<string, { gained: number; percents: number[]; count: number }>();

  for (const row of rows) {
    const existing = byPlatform.get(row.platform) ?? {
      gained: 0,
      percents: [],
      count: 0,
    };
    if (row.followersGained != null) existing.gained += row.followersGained;
    if (row.growthPercent != null) existing.percents.push(row.growthPercent);
    existing.count++;
    byPlatform.set(row.platform, existing);
  }

  return Array.from(byPlatform.entries()).map(([platform, data]) => ({
    platform,
    followersGained: data.gained,
    avgGrowthPercent:
      data.percents.length > 0
        ? data.percents.reduce((s, v) => s + v, 0) / data.percents.length
        : 0,
    accountCount: data.count,
  }));
}

export async function getCohortGrowthBreakdown(
  providedRows?: MemberGrowthRow[]
): Promise<CohortGrowthRow[]> {
  const rows = providedRows ?? (await getMemberGrowthRows());

  const byCohort = new Map<
    string,
    { count: number; percents: number[]; lifts: number[] }
  >();

  for (const row of rows) {
    if (!row.baselineDate) continue;
    const cohortDate = new Date(row.baselineDate);
    const cohort = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, "0")}`;

    const existing = byCohort.get(cohort) ?? {
      count: 0,
      percents: [],
      lifts: [],
    };
    existing.count++;
    if (row.growthPercent != null) existing.percents.push(row.growthPercent);
    if (row.engagementLift != null) existing.lifts.push(row.engagementLift);
    byCohort.set(cohort, existing);
  }

  return Array.from(byCohort.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cohort, data]) => ({
      cohort,
      accountCount: data.count,
      avgGrowthPercent:
        data.percents.length > 0
          ? data.percents.reduce((s, v) => s + v, 0) / data.percents.length
          : 0,
      avgEngagementLift:
        data.lifts.length > 0
          ? data.lifts.reduce((s, v) => s + v, 0) / data.lifts.length
          : 0,
    }));
}

export async function getUsageCorrelationStats(
  providedRows?: MemberGrowthRow[]
): Promise<UsageCorrelationStats> {
  const rows = providedRows ?? (await getMemberGrowthRows());

  const active = rows.filter((r) => r.isActive);
  const inactive = rows.filter((r) => !r.isActive);

  const avgGrowth = (arr: MemberGrowthRow[]) => {
    const byMember = new Map<string, { baseline: number; current: number }>();
    for (const row of arr) {
      if (row.baselineFollowers == null || row.currentFollowers == null) continue;
      const member = byMember.get(row.userId) ?? { baseline: 0, current: 0 };
      member.baseline += row.baselineFollowers;
      member.current += row.currentFollowers;
      byMember.set(row.userId, member);
    }
    const percentages = [...byMember.values()]
      .filter((member) => member.baseline > 0)
      .map(
        (member) =>
          ((member.current - member.baseline) / member.baseline) * 100
      );
    return percentages.length > 0
      ? percentages.reduce((sum, percentage) => sum + percentage, 0) /
          percentages.length
      : 0;
  };

  const avgEngagement = (arr: MemberGrowthRow[]) => {
    const byMember = new Map<string, number[]>();
    for (const row of arr) {
      if (row.currentEngagement == null) continue;
      byMember.set(row.userId, [
        ...(byMember.get(row.userId) ?? []),
        row.currentEngagement,
      ]);
    }
    const memberRates = [...byMember.values()].map(
      (rates) => rates.reduce((sum, rate) => sum + rate, 0) / rates.length
    );
    return memberRates.length > 0
      ? memberRates.reduce((sum, rate) => sum + rate, 0) / memberRates.length
      : 0;
  };

  const activeUserIds = new Set(active.map((r) => r.userId));
  const inactiveUserIds = new Set(inactive.map((r) => r.userId));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_DAYS);
  const accountKeys = new Set(
    rows.map((row) => accountKey(row.userId, row.platform))
  );
  const posts = await prisma.postAnalytics.findMany({
    where: {
      userId: { in: [...new Set(rows.map((row) => row.userId))] },
      publishedAt: { gte: thirtyDaysAgo },
      isDemo: false,
      platform: { not: null },
    },
    select: { userId: true, platform: true },
  });
  const validPosts = posts.filter(
    (post) =>
      post.platform != null &&
      accountKeys.has(accountKey(post.userId, post.platform))
  );
  const activePostCount = validPosts.filter((post) =>
    activeUserIds.has(post.userId)
  ).length;
  const inactivePostCount = validPosts.filter((post) =>
    inactiveUserIds.has(post.userId)
  ).length;

  return {
    activeUsers: activeUserIds.size,
    inactiveUsers: inactiveUserIds.size,
    activeAvgGrowth: avgGrowth(active),
    inactiveAvgGrowth: avgGrowth(inactive),
    activeAvgEngagement: avgEngagement(active),
    inactiveAvgEngagement: avgEngagement(inactive),
    activeAvgPosts: activeUserIds.size > 0 ? activePostCount / activeUserIds.size : 0,
    inactiveAvgPosts: inactiveUserIds.size > 0 ? inactivePostCount / inactiveUserIds.size : 0,
  };
}

export async function getDataQualityStats(): Promise<DataQualityStats> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - STALE_SYNC_DAYS);

  const allAccounts = await getImpactAccounts();
  const userIds = [...new Set(allAccounts.map((account) => account.userId))];
  const accountKeys = new Set(
    allAccounts.map((account) => accountKey(account.userId, account.platform))
  );
  const [totalUsers, baselines, posts, followerStats] = await Promise.all([
    prisma.user.count({
      where: {
        role: { not: "ADMIN" },
        accountStatus: { in: [...IMPACT_ACCOUNT_STATUSES] },
      },
    }),
    prisma.memberGrowthBaseline.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        platform: true,
        baselineDate: true,
      },
    }),
    prisma.postAnalytics.findMany({
      where: {
        userId: { in: userIds },
        isDemo: false,
        platform: { not: null },
      },
      select: { userId: true, platform: true },
    }),
    prisma.followerStats.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        platform: true,
        date: true,
        followerCount: true,
      },
    }),
  ]);

  const totalAccounts = allAccounts.length;
  const usersWithAccountIds = new Set(allAccounts.map((account) => account.userId));
  const usersWithoutAccounts = totalUsers - usersWithAccountIds.size;

  const baselineKeys = new Set(
    baselines
      .filter((baseline) => {
        const account = allAccounts.find(
          (candidate) =>
            accountKey(candidate.userId, candidate.platform) ===
            accountKey(baseline.userId, baseline.platform)
        );
        return (
          account != null &&
          baselineStartsAfterConnection(
            baseline.baselineDate,
            account.connectedAt
          )
        );
      })
      .map((baseline) => accountKey(baseline.userId, baseline.platform))
  );
  const accountsWithoutBaselines = allAccounts.filter(
    (account) =>
      !baselineKeys.has(accountKey(account.userId, account.platform))
  ).length;

  const accountsWithoutRecentSync = allAccounts.filter(
    (a) => !a.lastSyncAt || a.lastSyncAt < staleThreshold
  ).length;

  const accountsWithPostsSet = new Set(
    posts
      .filter(
        (post) =>
          post.platform != null &&
          accountKeys.has(accountKey(post.userId, post.platform))
      )
      .map((post) => accountKey(post.userId, post.platform!))
  );
  const accountsWithoutPostAnalytics = allAccounts.filter(
    (account) =>
      !accountsWithPostsSet.has(accountKey(account.userId, account.platform))
  ).length;

  const staleSyncCount = allAccounts.filter(
    (a) => !a.lastSyncAt || a.lastSyncAt < staleThreshold
  ).length;
  const suspiciousFollowerAccounts = findDuplicatedFollowerSeries(
    followerStats.filter((stat) =>
      accountKeys.has(accountKey(stat.userId, stat.platform))
    )
  ).size;

  return {
    usersWithoutAccounts,
    accountsWithoutBaselines,
    accountsWithoutRecentSync,
    accountsWithoutPostAnalytics,
    staleSyncCount,
    suspiciousFollowerAccounts,
    totalUsers,
    totalAccounts,
  };
}
