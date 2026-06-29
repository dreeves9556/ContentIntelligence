import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AnalyticsClient from "../AnalyticsClient";
import LockedTabOverlay from "@/components/LockedTabOverlay";
import { canAccessAnalytics } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const plan = (session.user.plan ?? "CALENDAR_ONLY") as UserPlan;

  const posts = await prisma.postAnalytics.findMany({
    where: { userId: session.user.id },
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
  });

  // Fetch best-time-to-post heatmaps for connected platforms
  const bestTimeRows = await prisma.bestTimeToPost.findMany({
    where: { userId: session.user.id },
    select: { platform: true, heatmap: true, updatedAt: true },
  });

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

  const content = <AnalyticsClient posts={serializedPosts} bestTimes={serializedBestTimes} />;

  if (!canAccessAnalytics(plan)) {
    return (
      <LockedTabOverlay
        requiredPlan="CREATOR"
        currentPlan={plan}
        featureName="Analytics"
        featureDescription="Upgrade to the Creator plan to unlock your full analytics dashboard — track views, engagement, and post performance across all your connected social accounts."
      >
        {content}
      </LockedTabOverlay>
    );
  }

  return content;
}
