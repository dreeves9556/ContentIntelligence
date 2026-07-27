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

const PREF_KEYS = [
  "postingReminder",
  "postPublished",
  "postFailed",
  "newComment",
  "analyticsMilestone",
  "streakWarning",
  "weeklyDigest",
  "accountDisconnected",
  "adminBroadcast",
] as const;

export async function updateNotificationPrefs(
  prefs: Partial<NotificationPrefs>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated" };

  const sanitized: Record<string, boolean> = {};
  for (const key of PREF_KEYS) {
    if (key in prefs && typeof prefs[key] === "boolean") {
      sanitized[key] = prefs[key];
    }
  }

  try {
    await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: sanitized,
      create: {
        userId: session.user.id,
        ...DEFAULT_PREFS,
        ...sanitized,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[NOTIFY PREFS] Failed to update:", err);
    return { success: false, error: "Failed to save preferences." };
  }
}

export async function getNotificationPrefsForUser(userId: string): Promise<NotificationPrefs> {
  const session = await auth();
  if (!session?.user?.id) return DEFAULT_PREFS;

  // Any authenticated caller could previously read any other user's
  // preferences by passing an arbitrary userId. Restrict to self or ADMIN.
  if (session.user.id !== userId && session.user.role !== "ADMIN") {
    return DEFAULT_PREFS;
  }

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
