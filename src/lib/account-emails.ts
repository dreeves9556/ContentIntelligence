import { Resend } from "resend";

interface AccountEmailUser {
  id: string;
  email: string | null;
  name: string | null;
}

function getEmailConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  return { baseUrl, fromAddress };
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

export async function sendAccessExpiringEmail(
  user: AccountEmailUser,
  expirationDate: Date
): Promise<{ success: boolean; error?: string }> {
  if (!user.email) return { success: false, error: "User has no email." };

  const { fromAddress } = getEmailConfig();
  const formattedDate = expirationDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: user.email,
      subject: "Your access is expiring soon",
      html: emailTemplate(
        "Access Expiring",
        `
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">Your Access Is Expiring Soon</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#5B6472;line-height:1.6;">
            Hi ${user.name ?? "there"},<br/><br/>
            Your access to The Local Post is scheduled to expire on <strong>${formattedDate}</strong>.
            If you'd like to continue using the platform, please contact our team to extend your access.
          </p>
        `
      ),
    });
    if (result.error) {
      console.error("[ACCOUNT EMAIL] Resend error:", result.error);
      return { success: false, error: "Failed to send email." };
    }
    return { success: true };
  } catch (err) {
    console.error("[ACCOUNT EMAIL] Failed to send:", err);
    return { success: false, error: "Failed to send email." };
  }
}

export async function sendAccessExpiredEmail(
  user: AccountEmailUser
): Promise<{ success: boolean; error?: string }> {
  if (!user.email) return { success: false, error: "User has no email." };

  const { fromAddress } = getEmailConfig();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: user.email,
      subject: "Your access has expired",
      html: emailTemplate(
        "Access Expired",
        `
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">Your Access Has Expired</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#5B6472;line-height:1.6;">
            Hi ${user.name ?? "there"},<br/><br/>
            Your access to The Local Post has expired. If you believe this is a mistake or would like to renew your access, please contact our team.
          </p>
        `
      ),
    });
    if (result.error) {
      console.error("[ACCOUNT EMAIL] Resend error:", result.error);
      return { success: false, error: "Failed to send email." };
    }
    return { success: true };
  } catch (err) {
    console.error("[ACCOUNT EMAIL] Failed to send:", err);
    return { success: false, error: "Failed to send email." };
  }
}

export async function sendAccountStatusChangedEmail(
  user: AccountEmailUser,
  oldStatus: string,
  newStatus: string
): Promise<{ success: boolean; error?: string }> {
  if (!user.email) return { success: false, error: "User has no email." };

  const { fromAddress } = getEmailConfig();

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: user.email,
      subject: "Your account status has been updated",
      html: emailTemplate(
        "Account Update",
        `
          <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">Account Status Updated</h1>
          <p style="margin:0 0 16px;font-size:14px;color:#5B6472;line-height:1.6;">
            Hi ${user.name ?? "there"},<br/><br/>
            Your account status has been updated from <strong>${oldStatus}</strong> to <strong>${newStatus}</strong>.
            If you have questions about this change, please contact our team.
          </p>
        `
      ),
    });
    if (result.error) {
      console.error("[ACCOUNT EMAIL] Resend error:", result.error);
      return { success: false, error: "Failed to send email." };
    }
    return { success: true };
  } catch (err) {
    console.error("[ACCOUNT EMAIL] Failed to send:", err);
    return { success: false, error: "Failed to send email." };
  }
}
