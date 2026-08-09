import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { abandonStaleSessions } from "@/app/dashboard/post-refinement/actions";
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
  if (!cronSecret || !authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ─── Posting Reminders ──────────────────────────────────────────────
// For each user with a calendar, check if today matches a posting day
// and send a reminder with the content for that day.
async function runPostingReminders(): Promise<number> {
  const now = new Date();

  // Find all users who have a calendar with content for today
  const calendars = await prisma.calendar.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
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

  // TODO: User timezone is not stored on the User model. Until it is,
  // reminders use the server's timezone. The per-user/per-day dedup below
  // prevents duplicate reminders if cron runs multiple times per day.
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

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
      // Per-user/per-day dedup: check if we already sent a posting
      // reminder for this user today. Previously dedup was only per-cron-run
      // (via seenUsers Set), so multiple cron runs per day would send
      // multiple reminders to the same user.
      const existing = await prisma.notificationLog.findFirst({
        where: {
          userId: cal.userId,
          type: "posting_reminder",
          createdAt: { gte: todayStart },
        },
      });
      if (existing) continue;

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
  // Atomically claim due pushes by updating PENDING → PROCESSING in a single
  // updateMany. This prevents concurrent cron workers from both fetching the
  // same PENDING pushes and double-sending. Previously findMany + update was
  // non-atomic — two workers could fetch the same rows before either updated.
  const now = new Date();
  const claimResult = await prisma.scheduledPushNotification.updateMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    data: {
      status: "PROCESSING",
    },
  });

  if (claimResult.count === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  // Fetch the rows we claimed (now in PROCESSING status)
  const claimedPushes = await prisma.scheduledPushNotification.findMany({
    where: {
      status: "PROCESSING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: 20,
  });

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const push of claimedPushes) {
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
    const [reminders, streaks, digests, scheduled, staleCleanup] = await Promise.all([
      runPostingReminders(),
      runStreakWarnings(),
      runWeeklyDigest(),
      runScheduledPushes(),
      abandonStaleSessions(),
    ]);

    return NextResponse.json({
      ok: true,
      postingReminders: reminders,
      streakWarnings: streaks,
      weeklyDigests: digests,
      scheduledPushes: scheduled,
      staleRefinementCleanup: staleCleanup,
    });
  } catch (err) {
    console.error("[CRON NOTIFICATIONS] Failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
