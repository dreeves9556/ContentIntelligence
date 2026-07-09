"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { Resend } from "resend";
import type { BugReportStatus } from "@prisma/client";

const BUG_REPORT_NOTIFY_EMAIL = "daniel.reevesky@gmail.com";

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

    // Send email notification (non-blocking)
    const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
    const resend = new Resend(process.env.RESEND_API_KEY);
    resend.emails
      .send({
        from: `The Local Post <${fromAddress}>`,
        to: BUG_REPORT_NOTIFY_EMAIL,
        subject: `Bug Report from ${data.name.trim()}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
            <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
              <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#dc2626;letter-spacing:0.12em;text-transform:uppercase;">New Bug Report</p>
            </div>
            <div style="padding:32px;">
              <table style="width:100%;font-size:14px;color:#101418;">
                <tr><td style="padding:4px 0;font-weight:600;width:100px;vertical-align:top;">Name:</td><td style="padding:4px 0;">${data.name.trim()}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Email:</td><td style="padding:4px 0;">${data.email.trim()}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Device:</td><td style="padding:4px 0;">${data.deviceInfo}</td></tr>
                <tr><td style="padding:4px 0;font-weight:600;vertical-align:top;">Account:</td><td style="padding:4px 0;">${user.email ?? user.id}</td></tr>
              </table>
              <h3 style="margin:24px 0 8px;font-size:14px;font-weight:700;color:#101418;">Description</h3>
              <p style="margin:0;font-size:14px;color:#5B6472;line-height:1.6;white-space:pre-wrap;">${data.description.trim()}</p>
            </div>
            <div style="background:#F7F9FC;padding:20px 32px;border-top:1px solid #E2E8F0;">
              <p style="margin:0;font-size:11px;color:#5B6472;text-align:center;line-height:1.6;">
                View all bug reports in the admin panel.
              </p>
            </div>
          </div>
        `,
      })
      .catch((err) => console.error("[BUG REPORT] Failed to send notification email:", err));

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
