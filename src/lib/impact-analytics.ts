import { prisma } from "@/lib/prisma";

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
  totalUsers: number;
  totalAccounts: number;
}

const STALE_SYNC_DAYS = 7;
const ACTIVE_DAYS = 30;

function computeWeightedEngagementRate(posts: { views: number; likes: number; comments: number }[]): number | null {
  const postsWithViews = posts.filter((p) => p.views > 0);
  if (postsWithViews.length === 0) return null;
  const totalViews = postsWithViews.reduce((s, p) => s + p.views, 0);
  const totalInteractions = postsWithViews.reduce((s, p) => s + p.likes + p.comments, 0);
  if (totalViews <= 0) return null;
  return (totalInteractions / totalViews) * 100;
}

export async function getImpactOverview(): Promise<ImpactOverview> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_DAYS);

  const [
    usersWithAccounts,
    totalAccounts,
    allBaselines,
    latestFollowerStats,
    postAnalyticsAgg,
    activeCalendarUsers,
    activeSyncUsers,
  ] = await Promise.all([
    prisma.zernioAccount.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.zernioAccount.count(),
    prisma.memberGrowthBaseline.findMany(),
    prisma.followerStats.findMany({
      orderBy: { date: "desc" },
      select: { userId: true, platform: true, followerCount: true, date: true },
    }),
    prisma.postAnalytics.aggregate({
      _sum: { views: true },
      _count: true,
    }),
    prisma.calendar.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.zernioAccount.findMany({
      where: { lastSyncAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const connectedMembers = usersWithAccounts.length;
  const connectedAccounts = totalAccounts;

  const latestByAccount = new Map<string, number>();
  for (const fs of latestFollowerStats) {
    const key = `${fs.userId}|${fs.platform}`;
    if (!latestByAccount.has(key)) {
      latestByAccount.set(key, fs.followerCount);
    }
  }

  let totalFollowersGained = 0;
  const growthPercents: number[] = [];
  let accountsWithValidBaseline = 0;
  let accountsMissingBaseline = 0;

  const accounts = await prisma.zernioAccount.findMany({
    select: { userId: true, platform: true },
  });

  for (const account of accounts) {
    const baseline = allBaselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    const current = latestByAccount.get(`${account.userId}|${account.platform}`);

    if (!baseline || baseline.baselineFollowerCount == null) {
      accountsMissingBaseline++;
      continue;
    }

    if (current == null) continue;

    const gained = current - baseline.baselineFollowerCount;
    totalFollowersGained += gained;
    accountsWithValidBaseline++;

    if (baseline.baselineFollowerCount > 0) {
      growthPercents.push((gained / baseline.baselineFollowerCount) * 100);
    }
  }

  const avgFollowerGrowth =
    growthPercents.length > 0
      ? growthPercents.reduce((s, v) => s + v, 0) / growthPercents.length
      : 0;

  const engagementLifts: number[] = [];
  const thirtyDaysAgoDate = new Date();
  thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - ACTIVE_DAYS);

  for (const account of accounts) {
    const baseline = allBaselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    if (!baseline || baseline.baselineEngagementRate == null) continue;

    const recentPosts = await prisma.postAnalytics.findMany({
      where: {
        userId: account.userId,
        publishedAt: { gte: thirtyDaysAgoDate },
      },
      select: { views: true, likes: true, comments: true },
    });

    const currentEngagement = computeWeightedEngagementRate(recentPosts);
    if (currentEngagement != null) {
      engagementLifts.push(currentEngagement - baseline.baselineEngagementRate);
    }
  }

  const avgEngagementLift =
    engagementLifts.length > 0
      ? engagementLifts.reduce((s, v) => s + v, 0) / engagementLifts.length
      : 0;

  const activeUserIds = new Set([
    ...activeCalendarUsers.map((u) => u.userId),
    ...activeSyncUsers.map((u) => u.userId),
  ]);

  return {
    connectedMembers,
    connectedAccounts,
    totalFollowersGained,
    avgFollowerGrowth,
    avgEngagementLift,
    totalViewsTracked: postAnalyticsAgg._sum.views ?? 0,
    totalPostsTracked: postAnalyticsAgg._count,
    activeUsers: activeUserIds.size,
    accountsWithValidBaseline,
    accountsMissingBaseline,
  };
}

export async function getImpactTimeSeries(): Promise<ImpactTimeSeriesPoint[]> {
  const allFollowerStats = await prisma.followerStats.findMany({
    orderBy: { date: "asc" },
    select: { date: true, followerCount: true, userId: true, platform: true },
  });

  const latestPerAccount = new Map<string, Map<string, number>>();

  for (const fs of allFollowerStats) {
    const dateKey = fs.date.toISOString().split("T")[0];
    const accountKey = `${fs.userId}|${fs.platform}`;
    if (!latestPerAccount.has(dateKey)) {
      latestPerAccount.set(dateKey, new Map());
    }
    latestPerAccount.get(dateKey)!.set(accountKey, fs.followerCount);
  }

  const result: ImpactTimeSeriesPoint[] = [];
  for (const [dateKey, accounts] of latestPerAccount) {
    let total = 0;
    for (const count of accounts.values()) {
      total += count;
    }
    result.push({ date: dateKey, totalFollowers: total });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEngagementTimeSeries(): Promise<EngagementTimeSeriesPoint[]> {
  const allPosts = await prisma.postAnalytics.findMany({
    orderBy: { publishedAt: "asc" },
    select: { publishedAt: true, views: true, likes: true, comments: true },
  });

  const weekMap = new Map<string, { views: number; interactions: number }>();

  for (const post of allPosts) {
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
  const accounts = await prisma.zernioAccount.findMany({
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

  const baselines = await prisma.memberGrowthBaseline.findMany();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - ACTIVE_DAYS);

  const allFollowerStats = await prisma.followerStats.findMany({
    orderBy: { date: "desc" },
    select: { userId: true, platform: true, followerCount: true, date: true },
  });

  const latestFollowerMap = new Map<string, number>();
  for (const fs of allFollowerStats) {
    const key = `${fs.userId}|${fs.platform}`;
    if (!latestFollowerMap.has(key)) {
      latestFollowerMap.set(key, fs.followerCount);
    }
  }

  const recentCalendars = await prisma.calendar.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeCalendarUserIds = new Set(recentCalendars.map((c) => c.userId));

  const recentSyncAccounts = await prisma.zernioAccount.findMany({
    where: { lastSyncAt: { gte: thirtyDaysAgo } },
    select: { userId: true },
    distinct: ["userId"],
  });
  const activeSyncUserIds = new Set(recentSyncAccounts.map((a) => a.userId));

  const rows: MemberGrowthRow[] = [];

  for (const account of accounts) {
    const baseline = baselines.find(
      (b) => b.userId === account.userId && b.platform === account.platform
    );
    const currentFollowers = latestFollowerMap.get(
      `${account.userId}|${account.platform}`
    );

    const baselineFollowers = baseline?.baselineFollowerCount ?? null;
    const followersGained =
      baselineFollowers != null && currentFollowers != null
        ? currentFollowers - baselineFollowers
        : null;
    const growthPercent =
      followersGained != null && baselineFollowers != null && baselineFollowers > 0
        ? (followersGained / baselineFollowers) * 100
        : null;

    const recentPosts = await prisma.postAnalytics.findMany({
      where: {
        userId: account.userId,
        publishedAt: { gte: thirtyDaysAgo },
      },
      select: { views: true, likes: true, comments: true },
    });
    const currentEngagement = computeWeightedEngagementRate(recentPosts);

    const baselineEngagement = baseline?.baselineEngagementRate ?? null;
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
      baselineDate: baseline?.baselineDate.toISOString() ?? null,
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
    });
  }

  return rows;
}

export async function getPlatformGrowthBreakdown(): Promise<PlatformGrowthBreakdownRow[]> {
  const rows = await getMemberGrowthRows();

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

export async function getCohortGrowthBreakdown(): Promise<CohortGrowthRow[]> {
  const rows = await getMemberGrowthRows();

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

export async function getUsageCorrelationStats(): Promise<UsageCorrelationStats> {
  const rows = await getMemberGrowthRows();

  const active = rows.filter((r) => r.isActive);
  const inactive = rows.filter((r) => !r.isActive);

  const avgGrowth = (arr: MemberGrowthRow[]) => {
    const valid = arr.filter((r) => r.growthPercent != null) as { growthPercent: number }[];
    return valid.length > 0
      ? valid.reduce((s, r) => s + r.growthPercent, 0) / valid.length
      : 0;
  };

  const avgEngagement = (arr: MemberGrowthRow[]) => {
    const valid = arr.filter((r) => r.currentEngagement != null) as { currentEngagement: number }[];
    return valid.length > 0
      ? valid.reduce((s, r) => s + r.currentEngagement, 0) / valid.length
      : 0;
  };

  const activeUserIds = new Set(active.map((r) => r.userId));
  const inactiveUserIds = new Set(inactive.map((r) => r.userId));

  const activePostCount = await prisma.postAnalytics.count({
    where: { userId: { in: Array.from(activeUserIds) } },
  });
  const inactivePostCount = await prisma.postAnalytics.count({
    where: { userId: { in: Array.from(inactiveUserIds) } },
  });

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

  const [
    totalUsers,
    totalAccounts,
    usersWithAccounts,
    allAccounts,
    baselines,
    accountsWithPosts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.zernioAccount.count(),
    prisma.zernioAccount.findMany({ select: { userId: true }, distinct: ["userId"] }),
    prisma.zernioAccount.findMany({
      select: { userId: true, platform: true, lastSyncAt: true },
    }),
    prisma.memberGrowthBaseline.findMany({ select: { userId: true, platform: true } }),
    prisma.postAnalytics.findMany({
      select: { userId: true },
      distinct: ["userId"],
    }),
  ]);

  const usersWithAccountIds = new Set(usersWithAccounts.map((u) => u.userId));
  const usersWithoutAccounts = totalUsers - usersWithAccountIds.size;

  const baselineKeys = new Set(
    baselines.map((b) => `${b.userId}|${b.platform}`)
  );
  const accountsWithoutBaselines = allAccounts.filter(
    (a) => !baselineKeys.has(`${a.userId}|${a.platform}`)
  ).length;

  const accountsWithoutRecentSync = allAccounts.filter(
    (a) => !a.lastSyncAt || a.lastSyncAt < staleThreshold
  ).length;

  const usersWithPostsSet = new Set(accountsWithPosts.map((p) => p.userId));
  const accountsWithoutPostAnalytics = allAccounts.filter(
    (a) => !usersWithPostsSet.has(a.userId)
  ).length;

  const staleSyncCount = allAccounts.filter(
    (a) => !a.lastSyncAt || a.lastSyncAt < staleThreshold
  ).length;

  return {
    usersWithoutAccounts,
    accountsWithoutBaselines,
    accountsWithoutRecentSync,
    accountsWithoutPostAnalytics,
    staleSyncCount,
    totalUsers,
    totalAccounts,
  };
}
