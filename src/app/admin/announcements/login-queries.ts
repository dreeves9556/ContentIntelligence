import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { LoginAnnouncementData } from "./login-actions";
import { sanitizeRichText } from "@/lib/sanitize";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getLoginAnnouncements(): Promise<{ announcements: LoginAnnouncementData[] }> {
  try {
    await requireAdmin();
  } catch {
    return { announcements: [] };
  }

  const rows = await prisma.loginAnnouncement.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { dismissals: true } } },
  });

  return {
    announcements: rows.map((r) => ({
      id: r.id,
      title: r.title,
      // Rows written before sanitisation was enforced are cleaned on read.
      message: sanitizeRichText(r.message),
      segment: r.segment,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      dismissalCount: r._count.dismissals,
    })),
  };
}

export async function getPendingLoginAnnouncements(
  userId: string,
  plan: string,
  hasConnectedAccounts: boolean
): Promise<{ announcements: LoginAnnouncementData[] }> {
  const activeAnnouncements = await prisma.loginAnnouncement.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (activeAnnouncements.length === 0) {
    return { announcements: [] };
  }

  const dismissed = await prisma.loginAnnouncementDismissal.findMany({
    where: { userId },
    select: { announcementId: true },
  });
  const dismissedIds = new Set(dismissed.map((d) => d.announcementId));

  const matching = activeAnnouncements.filter((a) => {
    if (dismissedIds.has(a.id)) return false;

    switch (a.segment) {
      case "all":
        return true;
      case "PRO":
        return plan === "PRO";
      case "CALENDAR_ONLY":
        return plan === "CALENDAR_ONLY";
      case "connected":
        return hasConnectedAccounts;
      case "unconnected":
        return !hasConnectedAccounts;
      default:
        return false;
    }
  });

  return {
    announcements: matching.map((a) => ({
      id: a.id,
      title: a.title,
      // Rows written before sanitisation was enforced are cleaned on read.
      message: sanitizeRichText(a.message),
      segment: a.segment,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      dismissalCount: 0,
    })),
  };
}
