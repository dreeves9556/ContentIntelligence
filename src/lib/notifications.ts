import webpush from "web-push";
import { prisma } from "@/lib/prisma";

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:hello@thelocalpost.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export type NotificationType =
  | "posting_reminder"
  | "post_published"
  | "post_failed"
  | "new_comment"
  | "analytics_milestone"
  | "streak_warning"
  | "weekly_digest"
  | "account_disconnected"
  | "admin_broadcast";

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

interface SendResult {
  sent: number;
  failed: number;
}

async function sendToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  // Clean up expired subscriptions (410 Gone or 404 Not Found)
  for (const [i, result] of results.entries()) {
    if (result.status === "rejected") {
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        await prisma.pushSubscription.deleteMany({
          where: { endpoint: subscriptions[i].endpoint },
        }).catch(() => {});
      }
    }
  }

  return { sent, failed };
}

async function logNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  url?: string
): Promise<void> {
  await prisma.notificationLog.create({
    data: { userId, type, title, body, url },
  }).catch((err: unknown) => console.error("[NOTIFY] Failed to log notification:", err));
}

const TYPE_TO_PREF: Record<NotificationType, string> = {
  posting_reminder: "postingReminder",
  post_published: "postPublished",
  post_failed: "postFailed",
  new_comment: "newComment",
  analytics_milestone: "analyticsMilestone",
  streak_warning: "streakWarning",
  weekly_digest: "weeklyDigest",
  account_disconnected: "accountDisconnected",
  admin_broadcast: "adminBroadcast",
};

async function isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return false; // default: all disabled until user opts in
  const prefKey = TYPE_TO_PREF[type] as keyof typeof prefs;
  return prefs[prefKey] as boolean;
}

export async function sendNotificationToUser(
  userId: string,
  type: NotificationType,
  payload: PushPayload
): Promise<SendResult> {
  const enabled = await isNotificationEnabled(userId, type);
  if (!enabled) return { sent: 0, failed: 0 };

  const result = await sendToUser(userId, payload);
  await logNotification(userId, type, payload.title, payload.body ?? "", payload.url);
  return result;
}

// ─── Posting Reminder ───────────────────────────────────────────────
export async function sendPostingReminder(
  userId: string,
  dayName: string,
  contentTitle: string,
  format: string
): Promise<SendResult> {
  return sendNotificationToUser(userId, "posting_reminder", {
    title: `Time to post: ${dayName}`,
    body: `Today's ${format}: "${contentTitle}". Open your calendar for the full caption and hook.`,
    tag: "posting-reminder",
    url: "/dashboard/calendar",
    requireInteraction: true,
  });
}

// ─── Post Published (via webhook) ───────────────────────────────────
export async function sendPostPublishedNotification(
  userId: string,
  platform: string,
  initialLikes: number
): Promise<SendResult> {
  const likesText = initialLikes > 0 ? ` — ${initialLikes} ${initialLikes === 1 ? "like" : "likes"} already` : "";
  return sendNotificationToUser(userId, "post_published", {
    title: `Your ${platform} post is live`,
    body: `Your post is published and visible to your audience${likesText}.`,
    tag: "post-published",
    url: "/dashboard/analytics",
  });
}

// ─── Post Failed (via webhook) ──────────────────────────────────────
export async function sendPostFailedNotification(
  userId: string,
  platform: string,
  errorMessage?: string
): Promise<SendResult> {
  const body = errorMessage
    ? `Your ${platform} post failed to publish: ${errorMessage}. Tap to retry.`
    : `Your ${platform} post failed to publish. Tap to retry.`;
  return sendNotificationToUser(userId, "post_failed", {
    title: `Post failed on ${platform}`,
    body,
    tag: "post-failed",
    url: "/dashboard/calendar",
    requireInteraction: true,
  });
}

// ─── New Comment (via webhook) ──────────────────────────────────────
export async function sendNewCommentNotification(
  userId: string,
  platform: string,
  commenterName?: string
): Promise<SendResult> {
  const who = commenterName ? `${commenterName} commented` : "Someone commented";
  return sendNotificationToUser(userId, "new_comment", {
    title: `New comment on your ${platform}`,
    body: `${who} on your ${platform} post. Tap to reply.`,
    tag: "new-comment",
    url: "/dashboard/analytics",
  });
}

// ─── Analytics Milestone (after sync) ───────────────────────────────
const MILESTONES = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export async function checkAndSendAnalyticsMilestone(
  userId: string,
  postTitle: string,
  views: number,
  platform: string
): Promise<SendResult | null> {
  const milestone = MILESTONES.find((m) => views >= m);
  if (!milestone) return null;

  // Check if we already sent a milestone notification for this post + milestone
  const existing = await prisma.notificationLog.findFirst({
    where: {
      userId,
      type: "analytics_milestone",
      body: { contains: postTitle.slice(0, 40) },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  if (existing) return null;

  const formatted = milestone >= 1_000_000 ? `${milestone / 1_000_000}M` : `${milestone / 1000}K`;
  return sendNotificationToUser(userId, "analytics_milestone", {
    title: `${formatted} views!`,
    body: `Your ${platform} post "${postTitle}" just hit ${formatted} views. Keep the momentum going.`,
    tag: "analytics-milestone",
    url: "/dashboard/analytics",
  });
}

// ─── Streak Warning (cron-based) ────────────────────────────────────
export async function sendStreakWarning(
  userId: string,
  daysSinceLastPost: number
): Promise<SendResult> {
  return sendNotificationToUser(userId, "streak_warning", {
    title: "Posting streak at risk",
    body: `You haven't posted in ${daysSinceLastPost} days. Generate a new calendar to stay consistent.`,
    tag: "streak-warning",
    url: "/dashboard/calendar",
  });
}

// ─── Weekly Digest (cron-based) ─────────────────────────────────────
export async function sendWeeklyDigest(
  userId: string,
  totalViews: number,
  totalLikes: number,
  totalComments: number,
  topPost: string,
  followerGrowth: number
): Promise<SendResult> {
  const growthText = followerGrowth > 0 ? ` You gained ${followerGrowth} new followers.` : "";
  return sendNotificationToUser(userId, "weekly_digest", {
    title: "Your weekly performance summary",
    body: `This week: ${totalViews.toLocaleString()} views, ${totalLikes} likes, ${totalComments} comments. Top post: "${topPost}".${growthText}`,
    tag: "weekly-digest",
    url: "/dashboard/analytics",
  });
}

// ─── Account Disconnected (via webhook) ─────────────────────────────
export async function sendAccountDisconnectedNotification(
  userId: string,
  platform: string
): Promise<SendResult> {
  return sendNotificationToUser(userId, "account_disconnected", {
    title: `${platform} connection expired`,
    body: `Your ${platform} connection expired. Reconnect to keep syncing your analytics.`,
    tag: "account-disconnected",
    url: "/dashboard/integrations",
    requireInteraction: true,
  });
}

// ─── Admin Broadcast ────────────────────────────────────────────────
export async function sendAdminBroadcast(
  userId: string,
  title: string,
  body: string,
  url?: string
): Promise<SendResult> {
  return sendNotificationToUser(userId, "admin_broadcast", {
    title,
    body,
    tag: "admin-broadcast",
    url: url ?? "/dashboard",
  });
}

// ─── Segment helpers ────────────────────────────────────────────────
export type PushSegment = "all" | "CALENDAR_ONLY" | "CREATOR" | "PRO";

export async function getUsersForSegment(segment: PushSegment): Promise<{ id: string }[]> {
  if (segment === "all") {
    return prisma.user.findMany({ select: { id: true } });
  }
  return prisma.user.findMany({
    where: { plan: segment },
    select: { id: true },
  });
}

export async function sendBroadcastToSegment(
  segment: PushSegment,
  title: string,
  body: string,
  url?: string
): Promise<{ sent: number; failed: number; totalUsers: number }> {
  const users = await getUsersForSegment(segment);
  let totalSent = 0;
  let totalFailed = 0;

  for (const user of users) {
    const result = await sendAdminBroadcast(user.id, title, body, url);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed, totalUsers: users.length };
}

// ─── User notification history ──────────────────────────────────────
export async function getUserNotifications(userId: string, limit = 20) {
  return prisma.notificationLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function markNotificationRead(id: string, userId: string) {
  return prisma.notificationLog.updateMany({
    where: { id, userId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notificationLog.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notificationLog.count({
    where: { userId, read: false },
  });
}
