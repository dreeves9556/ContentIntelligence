"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/sanitize";

export type LoginSegment = "all" | "CALENDAR_ONLY" | "PRO" | "connected" | "unconnected";

export interface LoginAnnouncementData {
  id: string;
  title: string;
  message: string;
  segment: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  dismissalCount: number;
}

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function createLoginAnnouncement(
  title: string,
  message: string,
  segment: LoginSegment
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!title.trim() || !message.trim()) {
    return { success: false, error: "Title and message are required." };
  }

  const sanitizedMessage = sanitizeRichText(message.trim());
  if (!sanitizedMessage) {
    return { success: false, error: "Message contains no renderable content." };
  }

  try {
    await prisma.loginAnnouncement.create({
      data: {
        title: title.trim(),
        message: sanitizedMessage,
        segment,
        isActive: true,
        createdBy: session.user.id,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[CREATE LOGIN ANNOUNCEMENT] Failed:", err);
    return { success: false, error: "Failed to create announcement." };
  }
}

export async function updateLoginAnnouncement(
  id: string,
  title: string,
  message: string,
  segment: LoginSegment,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  if (!title.trim() || !message.trim()) {
    return { success: false, error: "Title and message are required." };
  }

  const sanitizedMessage = sanitizeRichText(message.trim());
  if (!sanitizedMessage) {
    return { success: false, error: "Message contains no renderable content." };
  }

  try {
    await prisma.loginAnnouncement.update({
      where: { id },
      data: {
        title: title.trim(),
        message: sanitizedMessage,
        segment,
        isActive,
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[UPDATE LOGIN ANNOUNCEMENT] Failed:", err);
    return { success: false, error: "Failed to update announcement." };
  }
}

export async function deleteLoginAnnouncement(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await prisma.loginAnnouncement.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    console.error("[DELETE LOGIN ANNOUNCEMENT] Failed:", err);
    return { success: false, error: "Failed to delete announcement." };
  }
}

export async function toggleLoginAnnouncement(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    await prisma.loginAnnouncement.update({
      where: { id },
      data: { isActive },
    });
    return { success: true };
  } catch (err) {
    console.error("[TOGGLE LOGIN ANNOUNCEMENT] Failed:", err);
    return { success: false, error: "Failed to toggle announcement." };
  }
}

export async function dismissLoginAnnouncement(announcementId: string): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  try {
    await prisma.loginAnnouncementDismissal.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId: session.user.id,
        },
      },
      create: {
        announcementId,
        userId: session.user.id,
      },
      update: {
        dismissedAt: new Date(),
      },
    });
    return { success: true };
  } catch (err) {
    console.error("[DISMISS LOGIN ANNOUNCEMENT] Failed:", err);
    return { success: false };
  }
}
