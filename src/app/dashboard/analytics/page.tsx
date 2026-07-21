import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AnalyticsClient from "../AnalyticsClient";
import LockedTabOverlay from "@/components/LockedTabOverlay";
import { canAccessAnalytics } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { requireDashboardAccess } from "@/lib/server-access";

export default async function AnalyticsPage() {
  const access = await requireDashboardAccess();
  if (!access.allowed) redirect(access.status === 401 ? "/login" : "/account-expired");

  const plan = access.user.plan as UserPlan;
  const hasAnalyticsAccess = canAccessAnalytics(plan) || access.user.role === "ADMIN";
  const userId = access.user.id;

  const posts = hasAnalyticsAccess ? await prisma.postAnalytics.findMany({
    where: { userId },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      format: true,
      publishedAt: true,
      views: true,
      likes: true,
      comments: true,
      postUrl: true,
    },
  }) : [];

  // Fetch best-time-to-post heatmaps for connected platforms
  const bestTimeRows = hasAnalyticsAccess ? await prisma.bestTimeToPost.findMany({
    where: { userId },
    select: { platform: true, heatmap: true, updatedAt: true },
  }) : [];

  // Fetch follower stats for connected platforms
  const followerStatsRows = hasAnalyticsAccess ? await prisma.followerStats.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    select: { platform: true, date: true, followerCount: true, growthDelta: true, growthPercent: true },
  }) : [];

  // Fetch deep analytics for connected platforms
  const deepAnalyticsRows = hasAnalyticsAccess ? await prisma.deepAnalytics.findMany({
    where: { userId },
    select: { platform: true, dataType: true, data: true, updatedAt: true },
  }) : [];

  // Serialize dates to ISO strings for the client component
  const serializedPosts = posts.map((p) => ({
    ...p,
    publishedAt: p.publishedAt.toISOString(),
  }));

  const serializedBestTimes = bestTimeRows.map((r) => ({
    platform: r.platform,
    heatmap: r.heatmap as unknown as { grid: number[][]; bestSlots: { day: number; hour: number; engagement: number }[] },
    updatedAt: r.updatedAt.toISOString(),
  }));

  const serializedFollowerStats = followerStatsRows.map((r) => ({
    platform: r.platform,
    date: r.date.toISOString(),
    followerCount: r.followerCount,
    growthDelta: r.growthDelta,
    growthPercent: r.growthPercent,
  }));

  const serializedDeepAnalytics = deepAnalyticsRows.map((r) => ({
    platform: r.platform,
    dataType: r.dataType,
    data: r.data as unknown as { kind: string; payload: unknown },
    updatedAt: r.updatedAt.toISOString(),
  }));

  const content = <AnalyticsClient posts={serializedPosts} bestTimes={serializedBestTimes} followerStats={serializedFollowerStats} deepAnalytics={serializedDeepAnalytics} />;

  if (!canAccessAnalytics(plan)) {
    return (
      <LockedTabOverlay
        requiredPlan="PRO"
        currentPlan={plan}
        featureName="Analytics"
        featureDescription="Get Full Access to unlock your analytics dashboard — track views, engagement, and post performance across all your connected social accounts."
      >
        {content}
      </LockedTabOverlay>
    );
  }

  return content;
}
