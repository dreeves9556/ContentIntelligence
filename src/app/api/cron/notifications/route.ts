import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendPostingReminder,
  sendStreakWarning,
  sendWeeklyDigest,
  sendBroadcastToSegment,
  type PushSegment,
} from "@/lib/notifications";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

// ─── Posting Reminders ──────────────────────────────────────────────
// For each user with a calendar, check if today matches a posting day
// and send a reminder with the content for that day.
async function runPostingReminders(): Promise<number> {
  const today = new Date();
  const dayName = today.toLocaleDateString("en-US", { weekday: "long" });

  // Find all users who have a calendar with content for today
  const calendars = await prisma.calendar.findMany({
    where: {
      createdAt: {
        gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true } },
    },
  });

  // Deduplicate by user (only latest calendar per user)
  const seenUsers = new Set<string>();
  let sent = 0;

  for (const cal of calendars) {
    if (seenUsers.has(cal.userId)) continue;
    seenUsers.add(cal.userId);

    const content = cal.contentJson as unknown as {
      days?: { day: string; title: string; format: string }[];
    };
    const days = content?.days ?? [];
    const todayContent = days.find(
      (d) => d.day?.toUpperCase() === dayName.toUpperCase()
    );

    if (todayContent) {
      try {
        await sendPostingReminder(
          cal.userId,
          dayName,
          todayContent.title,
          todayContent.format
        );
        sent++;
      } catch (err) {
        console.error(`[CRON NOTIFICATIONS] Posting reminder failed for ${cal.userId}:`, err);
      }
    }
  }

  return sent;
}

// ─── Streak Warnings ────────────────────────────────────────────────
// Check users who haven't had analytics synced (proxy for posting) in 3+ days
async function runStreakWarnings(): Promise<number> {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Find users with connected accounts but no recent post analytics
  const usersWithAccounts = await prisma.zernioAccount.findMany({
    where: {
      connectedAt: { lt: threeDaysAgo },
    },
    select: { userId: true },
    distinct: ["userId"],
  });

  let sent = 0;

  for (const { userId } of usersWithAccounts) {
    // Check most recent post analytics
    const latestPost = await prisma.postAnalytics.findFirst({
      where: { userId },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    });

    if (!latestPost) continue;

    const daysSinceLastPost = Math.floor(
      (Date.now() - latestPost.publishedAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Warn at 3, 5, and 7 days (avoid spamming)
    if ([3, 5, 7].includes(daysSinceLastPost)) {
      // Check if we already sent a streak warning today
      const existing = await prisma.notificationLog.findFirst({
        where: {
          userId,
          type: "streak_warning",
          createdAt: { gte: new Date(todayStart()) },
        },
      });
      if (existing) continue;

      try {
        await sendStreakWarning(userId, daysSinceLastPost);
        sent++;
      } catch (err) {
        console.error(`[CRON NOTIFICATIONS] Streak warning failed for ${userId}:`, err);
      }
    }
  }

  return sent;
}

function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ─── Weekly Digest ──────────────────────────────────────────────────
// Runs on Mondays — summarizes last week's performance
async function runWeeklyDigest(): Promise<number> {
  const today = new Date();
  const isMonday = today.getDay() === 1;
  if (!isMonday) return 0;

  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Find all users with post analytics in the last week
  const usersWithPosts = await prisma.postAnalytics.findMany({
    where: { publishedAt: { gte: weekAgo } },
    select: { userId: true, title: true, views: true, likes: true, comments: true, publishedAt: true },
  });

  const byUser = new Map<string, typeof usersWithPosts>();
  for (const post of usersWithPosts) {
    if (!byUser.has(post.userId)) byUser.set(post.userId, []);
    byUser.get(post.userId)!.push(post);
  }

  let sent = 0;

  for (const [userId, posts] of byUser) {
    const totalViews = posts.reduce((s, p) => s + p.views, 0);
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const topPost = posts.reduce((best, p) => (p.views > best.views ? p : best), posts[0]);

    // Get follower growth for the week
    const followerRows = await prisma.followerStats.findMany({
      where: { userId, date: { gte: weekAgo } },
      orderBy: { date: "asc" },
      select: { growthDelta: true },
    });
    const followerGrowth = followerRows.reduce((s, r) => s + r.growthDelta, 0);

    // Check if we already sent a digest this week
    const existing = await prisma.notificationLog.findFirst({
      where: {
        userId,
        type: "weekly_digest",
        createdAt: { gte: weekAgo },
      },
    });
    if (existing) continue;

    try {
      await sendWeeklyDigest(
        userId,
        totalViews,
        totalLikes,
        totalComments,
        topPost.title,
        followerGrowth
      );
      sent++;
    } catch (err) {
      console.error(`[CRON NOTIFICATIONS] Weekly digest failed for ${userId}:`, err);
    }
  }

  return sent;
}

// ─── Scheduled Admin Push Notifications ─────────────────────────────
async function runScheduledPushes(): Promise<{ processed: number; sent: number; failed: number }> {
  const duePushes = await prisma.scheduledPushNotification.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: new Date() },
    },
    orderBy: { scheduledFor: "asc" },
    take: 20,
  });

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const push of duePushes) {
    processed++;
    try {
      const result = await sendBroadcastToSegment(
        push.segment as PushSegment,
        push.title,
        push.body,
        push.url ?? undefined
      );

      await prisma.scheduledPushNotification.update({
        where: { id: push.id },
        data: {
          status: "SENT",
          sentCount: result.sent,
          failedCount: result.failed,
        },
      });

      totalSent += result.sent;
      totalFailed += result.failed;
    } catch (err) {
      console.error(`[CRON NOTIFICATIONS] Scheduled push ${push.id} failed:`, err);
      await prisma.scheduledPushNotification.update({
        where: { id: push.id },
        data: { status: "FAILED" },
      });
      totalFailed++;
    }
  }

  return { processed, sent: totalSent, failed: totalFailed };
}

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [reminders, streaks, digests, scheduled] = await Promise.all([
      runPostingReminders(),
      runStreakWarnings(),
      runWeeklyDigest(),
      runScheduledPushes(),
    ]);

    return NextResponse.json({
      ok: true,
      postingReminders: reminders,
      streakWarnings: streaks,
      weeklyDigests: digests,
      scheduledPushes: scheduled,
    });
  } catch (err) {
    console.error("[CRON NOTIFICATIONS] Failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
