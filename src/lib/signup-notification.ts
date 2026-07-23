import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

type SignupSource = "self-registration" | "admin-add" | "admin-bulk-add";

interface SignupNotificationConfig {
  notifyOnSignup: boolean;
  adminNotifyEmail: string | null;
}

async function getNotificationConfig(): Promise<SignupNotificationConfig> {
  const config = await prisma.platformConfig.findUnique({
    where: { id: "default" },
    select: { notifyOnSignup: true, adminNotifyEmail: true },
  });
  return {
    notifyOnSignup: config?.notifyOnSignup ?? false,
    adminNotifyEmail: config?.adminNotifyEmail ?? null,
  };
}

function emailTemplate(title: string, bodyHtml: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
      <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
        <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#1E56D6;letter-spacing:0.12em;text-transform:uppercase;">${title}</p>
      </div>
      <div style="padding:32px;">
        ${bodyHtml}
      </div>
      <div style="background:#F7F9FC;padding:20px 32px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:11px;color:#5B6472;text-align:center;line-height:1.6;">
          The Local Post — Be the local authority.
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sourceLabel(source: SignupSource): string {
  switch (source) {
    case "self-registration":
      return "registered via invite link";
    case "admin-add":
      return "was added by an admin";
    case "admin-bulk-add":
      return "were added by an admin (bulk invite)";
  }
}

/**
 * Send a notification email to the admin when a single user signs up or is added.
 * No-ops if notifications are disabled or no admin email is configured.
 */
export async function sendSignupNotification(
  email: string,
  source: SignupSource
): Promise<void> {
  const config = await getNotificationConfig();
  if (!config.notifyOnSignup || !config.adminNotifyEmail) return;

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const label = sourceLabel(source);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: config.adminNotifyEmail,
      subject: `New signup on The Local Post — ${email}`,
      html: emailTemplate(
        "New User Signup",
        `
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">New User Signup</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#5B6472;line-height:1.6;">
            A new user ${label}:
          </p>
          <p style="margin:0 0 16px;font-size:16px;font-weight:600;color:#101418;">${escapeHtml(email)}</p>
          <p style="margin:0;font-size:12px;color:#5B6472;line-height:1.6;">
            View all users in the admin panel.
          </p>
        `
      ),
    });
    if (result.error) {
      console.error("[SIGNUP NOTIFICATION] Resend error:", result.error);
    }
  } catch (err) {
    console.error("[SIGNUP NOTIFICATION] Failed to send:", err);
  }
}

/**
 * Send a single notification email to the admin when multiple users are added via bulk invite.
 * Lists all successfully added emails. No-ops if notifications are disabled or no admin email is configured.
 */
export async function sendBulkSignupNotification(
  emails: string[],
  source: SignupSource = "admin-bulk-add"
): Promise<void> {
  if (emails.length === 0) return;

  const config = await getNotificationConfig();
  if (!config.notifyOnSignup || !config.adminNotifyEmail) return;

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const label = sourceLabel(source);

  const emailListHtml = emails
    .map(
      (e) =>
        `<li style="margin:0 0 6px;font-size:14px;color:#101418;">${escapeHtml(e)}</li>`
    )
    .join("");

  const countLabel = emails.length === 1 ? "1 new user" : `${emails.length} new users`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: config.adminNotifyEmail,
      subject: `Bulk signup on The Local Post — ${countLabel} added`,
      html: emailTemplate(
        "New User Signups",
        `
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">${countLabel} ${label}</h1>
          <ul style="margin:0 0 16px;padding-left:20px;list-style:disc;">
            ${emailListHtml}
          </ul>
          <p style="margin:0;font-size:12px;color:#5B6472;line-height:1.6;">
            View all users in the admin panel.
          </p>
        `
      ),
    });
    if (result.error) {
      console.error("[BULK SIGNUP NOTIFICATION] Resend error:", result.error);
    }
  } catch (err) {
    console.error("[BULK SIGNUP NOTIFICATION] Failed to send:", err);
  }
}
