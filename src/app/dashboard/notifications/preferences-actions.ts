"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface NotificationPrefs {
  postingReminder: boolean;
  postPublished: boolean;
  postFailed: boolean;
  newComment: boolean;
  analyticsMilestone: boolean;
  streakWarning: boolean;
  weeklyDigest: boolean;
  accountDisconnected: boolean;
  adminBroadcast: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  postingReminder: false,
  postPublished: false,
  postFailed: false,
  newComment: false,
  analyticsMilestone: false,
  streakWarning: false,
  weeklyDigest: false,
  accountDisconnected: false,
  adminBroadcast: false,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const session = await auth();
  if (!session?.user?.id) return DEFAULT_PREFS;

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  });

  if (!prefs) return DEFAULT_PREFS;

  return {
    postingReminder: prefs.postingReminder,
    postPublished: prefs.postPublished,
    postFailed: prefs.postFailed,
    newComment: prefs.newComment,
    analyticsMilestone: prefs.analyticsMilestone,
    streakWarning: prefs.streakWarning,
    weeklyDigest: prefs.weeklyDigest,
    accountDisconnected: prefs.accountDisconnected,
    adminBroadcast: prefs.adminBroadcast,
  };
}

export async function updateNotificationPrefs(
  prefs: Partial<NotificationPrefs>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  try {
    await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: prefs,
      create: {
        userId: session.user.id,
        ...DEFAULT_PREFS,
        ...prefs,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[NOTIFY PREFS] Failed to update:", err);
    return { success: false, error: "Failed to save preferences." };
  }
}

export async function getNotificationPrefsForUser(userId: string): Promise<NotificationPrefs> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  if (!prefs) return DEFAULT_PREFS;
  return {
    postingReminder: prefs.postingReminder,
    postPublished: prefs.postPublished,
    postFailed: prefs.postFailed,
    newComment: prefs.newComment,
    analyticsMilestone: prefs.analyticsMilestone,
    streakWarning: prefs.streakWarning,
    weeklyDigest: prefs.weeklyDigest,
    accountDisconnected: prefs.accountDisconnected,
    adminBroadcast: prefs.adminBroadcast,
  };
}
