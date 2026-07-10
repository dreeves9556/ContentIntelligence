"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  sendBroadcastToSegment,
  type PushSegment,
} from "@/lib/notifications";

export interface ScheduledPushData {
  id: string;
  title: string;
  body: string;
  url: string | null;
  segment: string;
  scheduledFor: string;
  status: string;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export async function getScheduledPushes(): Promise<{ pushes: ScheduledPushData[] }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { pushes: [] };

  const rows = await prisma.scheduledPushNotification.findMany({
    orderBy: { scheduledFor: "desc" },
    take: 50,
  });

  return {
    pushes: rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      url: r.url,
      segment: r.segment,
      scheduledFor: r.scheduledFor.toISOString(),
      status: r.status,
      sentCount: r.sentCount,
      failedCount: r.failedCount,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function sendPushNow(
  title: string,
  body: string,
  url: string | undefined,
  segment: PushSegment
): Promise<{ success: boolean; sent: number; failed: number; totalUsers: number; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, sent: 0, failed: 0, totalUsers: 0, error: "Unauthorized" };
  }

  if (!title.trim() || !body.trim()) {
    return { success: false, sent: 0, failed: 0, totalUsers: 0, error: "Title and body are required." };
  }

  try {
    const result = await sendBroadcastToSegment(segment, title.trim(), body.trim(), url?.trim() || undefined);

    // Log the push in the scheduled table as a sent record
    await prisma.scheduledPushNotification.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        url: url?.trim() || null,
        segment,
        scheduledFor: new Date(),
        status: "SENT",
        sentCount: result.sent,
        failedCount: result.failed,
        createdBy: session.user.id,
      },
    });

    return { success: true, ...result };
  } catch (err) {
    console.error("[SEND PUSH NOW] Failed:", err);
    return { success: false, sent: 0, failed: 0, totalUsers: 0, error: "Failed to send push notification." };
  }
}

export async function schedulePush(
  title: string,
  body: string,
  url: string | undefined,
  segment: PushSegment,
  scheduledFor: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (!title.trim() || !body.trim()) {
    return { success: false, error: "Title and body are required." };
  }

  const scheduledDate = new Date(scheduledFor);
  if (isNaN(scheduledDate.getTime())) {
    return { success: false, error: "Invalid date/time." };
  }

  if (scheduledDate.getTime() <= Date.now()) {
    return { success: false, error: "Scheduled time must be in the future." };
  }

  try {
    await prisma.scheduledPushNotification.create({
      data: {
        title: title.trim(),
        body: body.trim(),
        url: url?.trim() || null,
        segment,
        scheduledFor: scheduledDate,
        status: "PENDING",
        createdBy: session.user.id,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[SCHEDULE PUSH] Failed:", err);
    return { success: false, error: "Failed to schedule push notification." };
  }
}

export async function cancelScheduledPush(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const push = await prisma.scheduledPushNotification.findUnique({ where: { id } });
    if (!push) return { success: false, error: "Push notification not found." };
    if (push.status !== "PENDING") return { success: false, error: "Only pending pushes can be cancelled." };

    await prisma.scheduledPushNotification.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    return { success: true };
  } catch (err) {
    console.error("[CANCEL PUSH] Failed:", err);
    return { success: false, error: "Failed to cancel push notification." };
  }
}

export interface NotificationLogData {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string | null;
  read: boolean;
  createdAt: string;
}

export async function getRecentNotificationLogs(limit = 100): Promise<{ logs: (NotificationLogData & { userEmail: string | null })[] }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { logs: [] };

  const rows = await prisma.notificationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { email: true } } },
  });

  return {
    logs: rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      url: r.url,
      read: r.read,
      createdAt: r.createdAt.toISOString(),
      userEmail: r.user.email,
    })),
  };
}
