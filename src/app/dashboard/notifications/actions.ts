"use server";

import { auth } from "@/auth";
import {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "@/lib/notifications";

export async function fetchNotifications() {
  const session = await auth();
  if (!session?.user?.id) return { notifications: [], unreadCount: 0 };
  const [notifications, unreadCount] = await Promise.all([
    getUserNotifications(session.user.id, 20),
    getUnreadCount(session.user.id),
  ]);
  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      url: n.url,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function dismissNotification(id: string) {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  await markNotificationRead(id, session.user.id);
  return { success: true };
}

export async function dismissAllNotifications() {
  const session = await auth();
  if (!session?.user?.id) return { success: false };
  await markAllNotificationsRead(session.user.id);
  return { success: true };
}
