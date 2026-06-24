"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { BugReportStatus } from "@prisma/client";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }
  return session.user;
}

// ─── User-facing action ──────────────────────────────────────────────────────

export async function submitBugReport(data: {
  name: string;
  email: string;
  deviceInfo: string;
  description: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireUser();

    if (!data.name.trim() || !data.email.trim() || !data.description.trim()) {
      return { success: false, error: "Name, email, and description are required." };
    }

    if (data.deviceInfo !== "mobile" && data.deviceInfo !== "browser") {
      return { success: false, error: "Please select Mobile or Browser." };
    }

    await prisma.bugReport.create({
      data: {
        userId: user.id,
        name: data.name.trim(),
        email: data.email.trim(),
        deviceInfo: data.deviceInfo,
        description: data.description.trim(),
      },
    });

    revalidatePath("/admin/bugs");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}

// ─── Admin-facing actions ────────────────────────────────────────────────────

export interface BugReportData {
  id: string;
  userId: string;
  name: string;
  email: string;
  deviceInfo: string;
  description: string;
  status: BugReportStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
  userName: string | null;
  userEmail: string | null;
}

function mapReport(r: {
  id: string;
  userId: string;
  name: string;
  email: string;
  deviceInfo: string;
  description: string;
  status: BugReportStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { name: string | null; email: string | null };
}): BugReportData {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    email: r.email,
    deviceInfo: r.deviceInfo,
    description: r.description,
    status: r.status,
    adminNotes: r.adminNotes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    userName: r.user.name,
    userEmail: r.user.email,
  };
}

export async function getBugReports(): Promise<BugReportData[]> {
  await requireAdmin();
  const reports = await prisma.bugReport.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, email: true } } },
  });
  return reports.map(mapReport);
}

export async function updateBugReportStatus(
  id: string,
  status: BugReportStatus,
  adminNotes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.bugReport.update({
      where: { id },
      data: {
        status,
        ...(adminNotes !== undefined ? { adminNotes: adminNotes.trim() || null } : {}),
      },
    });
    revalidatePath("/admin/bugs");
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { success: false, error: msg };
  }
}
