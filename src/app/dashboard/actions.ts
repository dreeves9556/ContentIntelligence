"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import webpush from "web-push";
import { getAnthropicApiKey, getAnthropicModel, getPlatformConfig } from "@/lib/platform-config";
import { summarizeFollowerGrowth } from "@/lib/follower-stats";
import { summarizeDemographicsForAI } from "@/lib/deep-analytics";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:hello@contentintelligence.co",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

const SEED_POSTS = [
  {
    title: "How to Build Your Personal Brand in 2025",
    format: "REEL",
    publishedAt: new Date("2025-06-15"),
    views: 12500,
    likes: 980,
    comments: 145,
  },
  {
    title: "5 Tips for Local Business Marketing",
    format: "CAROUSEL",
    publishedAt: new Date("2025-06-12"),
    views: 8900,
    likes: 620,
    comments: 87,
  },
  {
    title: "Behind the Scenes: Our Creative Process",
    format: "REEL",
    publishedAt: new Date("2025-06-10"),
    views: 15200,
    likes: 1450,
    comments: 203,
  },
  {
    title: "Expert Advice: Industry Trends to Watch",
    format: "STATIC",
    publishedAt: new Date("2025-06-08"),
    views: 6700,
    likes: 410,
    comments: 62,
  },
  {
    title: "Customer Success Story: Local Cafe Rebrand",
    format: "CAROUSEL",
    publishedAt: new Date("2025-06-05"),
    views: 9800,
    likes: 870,
    comments: 134,
  },
  {
    title: "Product Launch: What's New This Month",
    format: "REEL",
    publishedAt: new Date("2025-06-03"),
    views: 18300,
    likes: 1720,
    comments: 298,
  },
  {
    title: "Community Spotlight: Local Artists",
    format: "STATIC",
    publishedAt: new Date("2025-06-01"),
    views: 5400,
    likes: 380,
    comments: 51,
  },
];

export async function seedPostAnalytics() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Check if user already has seed data
  const existing = await prisma.postAnalytics.count({
    where: { userId: session.user.id },
  });

  if (existing > 0) {
    return { success: true, message: `Already have ${existing} posts`, count: existing };
  }

  await prisma.postAnalytics.createMany({
    data: SEED_POSTS.map((post) => ({
      ...post,
      userId: session.user!.id!,
      externalId: `ig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    })),
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Seeded 7 dummy posts", count: 7 };
}

export interface AIInsightResult {
  success: boolean;
  insight?: string;
  generatedAt?: string;
  error?: string;
}

export async function getCachedInsight(): Promise<AIInsightResult> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const cached = await prisma.analyticsCache.findUnique({
    where: { key: `ai_insight_${session.user.id}` },
  });

  if (!cached) {
    // No cached insight yet — check if user has posts to generate one
    const postCount = await prisma.postAnalytics.count({
      where: { userId: session.user.id },
    });

    if (postCount > 0) {
      // Generate insight on the spot (one-time catch-up)
      return generateAIInsight(session.user.id);
    }

    return { success: true, insight: "Connect your social accounts and sync analytics to get personalized AI insights about your content performance." };
  }

  const data = cached.data as { insight: string };
  return { success: true, insight: data.insight, generatedAt: cached.updatedAt.toISOString() };
}

export async function generateAIInsight(userId: string): Promise<AIInsightResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return { success: false, error: "Not authenticated" };
  }

  const posts = await prisma.postAnalytics.findMany({
    where: { userId },
    orderBy: { publishedAt: "desc" },
    take: 30,
    select: {
      title: true,
      format: true,
      publishedAt: true,
      views: true,
      likes: true,
      comments: true,
    },
  });

  if (posts.length === 0) {
    const fallback = "Connect your social accounts and sync analytics to get personalized AI insights about your content performance.";
    await prisma.analyticsCache.upsert({
      where: { key: `ai_insight_${userId}` },
      update: { data: { insight: fallback } },
      create: { key: `ai_insight_${userId}`, data: { insight: fallback } },
    });
    return { success: true, insight: fallback };
  }

  const apiKey = await getAnthropicApiKey();
  if (!apiKey) {
    return { success: false, error: "AI service not configured" };
  }

  const model = await getAnthropicModel();

  // Compute summary stats
  const totalViews = posts.reduce((s, p) => s + p.views, 0);
  const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
  const totalComments = posts.reduce((s, p) => s + p.comments, 0);
  const avgEngagement = totalViews > 0 ? ((totalLikes + totalComments) / totalViews * 100).toFixed(1) : "0";

  // Group by format
  const byFormat: Record<string, { count: number; views: number; likes: number; comments: number }> = {};
  for (const p of posts) {
    if (!byFormat[p.format]) byFormat[p.format] = { count: 0, views: 0, likes: 0, comments: 0 };
    byFormat[p.format].count++;
    byFormat[p.format].views += p.views;
    byFormat[p.format].likes += p.likes;
    byFormat[p.format].comments += p.comments;
  }

  // Recent vs older comparison
  const mid = Math.ceil(posts.length / 2);
  const recent = posts.slice(0, mid);
  const older = posts.slice(mid);
  const recentAvgViews = recent.reduce((s, p) => s + p.views, 0) / (recent.length || 1);
  const olderAvgViews = older.reduce((s, p) => s + p.views, 0) / (older.length || 1);
  const viewsTrend = olderAvgViews > 0 ? (((recentAvgViews - olderAvgViews) / olderAvgViews) * 100).toFixed(0) : "0";

  const formatSummary = Object.entries(byFormat)
    .map(([fmt, d]) => `${fmt}: ${d.count} posts, ${d.views} views, ${((d.likes + d.comments) / (d.views || 1) * 100).toFixed(1)}% engagement`)
    .join("\n");

  const topPosts = posts.slice(0, 5).map((p, i) =>
    `${i + 1}. "${p.title}" (${p.format}) — ${p.views} views, ${p.likes} likes, ${p.comments} comments`
  ).join("\n");

  // Fetch follower growth data for the AI prompt
  const followerStatsRows = await prisma.followerStats.findMany({
    where: { userId },
    orderBy: { date: "asc" },
    select: { platform: true, date: true, followerCount: true, growthDelta: true, growthPercent: true },
  });

  const PLATFORM_LABELS_LOWER: Record<string, string> = {
    instagram: "Instagram",
    tiktok: "TikTok",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    facebook: "Facebook",
  };

  const followerGrowthSummary = followerStatsRows.length > 0
    ? Object.entries(
        followerStatsRows.reduce<Record<string, typeof followerStatsRows>>((acc, row) => {
          if (!acc[row.platform]) acc[row.platform] = [];
          acc[row.platform].push(row);
          return acc;
        }, {})
      )
      .map(([platform, rows]) =>
        summarizeFollowerGrowth(
          rows.map((r) => ({
            date: r.date.toISOString().split("T")[0],
            followerCount: r.followerCount,
            growthDelta: r.growthDelta,
            growthPercent: r.growthPercent,
          })),
          PLATFORM_LABELS_LOWER[platform.toLowerCase()] ?? platform
        )
      )
      .join("\n")
    : "";

  // Fetch demographics data for the AI prompt
  const demographicsRows = await prisma.deepAnalytics.findMany({
    where: { userId, dataType: "demographics" },
    select: { platform: true, data: true },
  });
  const demographicsSummary = summarizeDemographicsForAI(
    demographicsRows.map((r) => ({ platform: r.platform, data: r.data as unknown as { kind: string; payload: unknown } }))
  );

  const config = await getPlatformConfig();
  const defaultPrompt = `You are a social media content coach. Analyze this creator's recent performance data and provide ONE concise, actionable insight (2-3 sentences max). Be specific with numbers and give a clear recommendation.

PERFORMANCE SUMMARY:
- Total posts: ${posts.length}
- Total views: ${totalViews}
- Average engagement rate: ${avgEngagement}%
- Views trend (recent vs older): ${viewsTrend}%

BREAKDOWN BY FORMAT:
${formatSummary}

TOP PERFORMING POSTS:
${topPosts}
${followerGrowthSummary ? `\nFOLLOWER GROWTH:\n${followerGrowthSummary}\n` : ""}
${demographicsSummary ? `\nAUDIENCE DEMOGRAPHICS:\n${demographicsSummary}\n` : ""}
Respond with ONLY the insight text — no headers, no bullet points, no markdown. Keep it under 200 words. Reference specific formats or content types that are working well and give one actionable next step. If follower growth data is available, mention how many followers were gained this week and which platform grew the most. If demographics data is available, mention the audience composition (e.g., "Your audience is 65% women aged 25-34") and tailor the recommendation to that audience.`;

  const prompt = (config.insightPromptTemplate ?? defaultPrompt)
    .replace(/\{\{totalPosts\}\}/g, String(posts.length))
    .replace(/\{\{totalViews\}\}/g, String(totalViews))
    .replace(/\{\{avgEngagement\}\}/g, String(avgEngagement))
    .replace(/\{\{viewsTrend\}\}/g, String(viewsTrend))
    .replace(/\{\{formatSummary\}\}/g, formatSummary)
    .replace(/\{\{topPosts\}\}/g, topPosts)
    .replace(/\{\{followerGrowth\}\}/g, followerGrowthSummary)
    .replace(/\{\{demographics\}\}/g, demographicsSummary);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 250,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error (insight):", errorText);
      return { success: false, error: `AI service error (${response.status})` };
    }

    const data = await response.json();
    const insight = data.content?.[0]?.text?.trim() || "";

    if (!insight) {
      return { success: false, error: "No insight generated" };
    }

    // Cache the insight
    await prisma.analyticsCache.upsert({
      where: { key: `ai_insight_${userId}` },
      update: { data: { insight } },
      create: { key: `ai_insight_${userId}`, data: { insight } },
    });

    return { success: true, insight };
  } catch (err) {
    console.error("AI Insight generation failed:", err);
    return { success: false, error: "Failed to generate insight" };
  }
}

export async function subscribeUser(sub: PushSubscription) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const serializedSub = JSON.parse(JSON.stringify(sub)) as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint: serializedSub.endpoint },
    update: {
      userId: session.user.id,
      p256dh: serializedSub.keys.p256dh,
      auth: serializedSub.keys.auth,
    },
    create: {
      userId: session.user.id,
      endpoint: serializedSub.endpoint,
      p256dh: serializedSub.keys.p256dh,
      auth: serializedSub.keys.auth,
    },
  });

  return { success: true };
}

export async function unsubscribeUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id },
  });

  return { success: true };
}

export async function getPushSubscriptionStatus() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const count = await prisma.pushSubscription.count({
    where: { userId: session.user.id },
  });

  return { subscribed: count > 0, count };
}

export async function sendNotification(message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subscriptions.length === 0) {
    throw new Error("No push subscriptions found");
  }

  const payload: PushPayload = {
    title: "Test Notification",
    body: message,
    icon: "/icon.svg",
    url: "/dashboard",
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) {
    throw new Error("Failed to send all push notifications");
  }

  return { success: true, sent: results.length - failed.length };
}

export async function sendNotificationToUser(userId: string, payload: PushPayload) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (session.user.role !== "ADMIN") throw new Error("Not authorized");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { success: false, error: "No push subscriptions found" };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return { success: true, sent, failed };
}
