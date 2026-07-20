import { Resend } from "resend";

interface TeamInviteEmailParams {
  email: string;
  organizationName: string;
  registerUrl: string;
  isTeamAdminInvite: boolean;
}

/**
 * Send a team invitation email using the existing Resend + The Local Post
 * email template style. Returns true on success, false on failure.
 */
export async function sendTeamInviteEmail({
  email,
  organizationName,
  registerUrl,
  isTeamAdminInvite,
}: TeamInviteEmailParams): Promise<boolean> {
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const heading = isTeamAdminInvite
    ? `You've been invited to manage ${organizationName} on The Local Post.`
    : `You've been invited to join ${organizationName} on The Local Post.`;

  const subtext = isTeamAdminInvite
    ? "Create your account to invite and manage your organization's seats."
    : "Create your account to access your content dashboard.";

  const ctaLabel = "Create Your Account";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: email,
      subject: isTeamAdminInvite
        ? `You're invited to manage ${organizationName} on The Local Post`
        : `You're invited to join ${organizationName} on The Local Post`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
            <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#1E56D6;letter-spacing:0.12em;text-transform:uppercase;">Your Town. Your Post.</p>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">${heading}</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#5B6472;line-height:1.6;">
              ${subtext} This link is single-use and expires in 7 days.
            </p>

            <a href="${registerUrl}" style="display:inline-block;padding:12px 28px;background:#1E56D6;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;border-radius:6px;margin-bottom:16px;">${ctaLabel}</a>

            <p style="margin:12px 0 0;font-size:12px;color:#5B6472;line-height:1.6;">
              If the button above doesn't work, copy and paste this link into your browser:<br/>
              <a href="${registerUrl}" style="color:#1E56D6;text-decoration:underline;word-break:break-all;">${registerUrl}</a>
            </p>
          </div>
          <div style="background:#F7F9FC;padding:20px 32px;border-top:1px solid #E2E8F0;">
            <p style="margin:0;font-size:11px;color:#5B6472;text-align:center;line-height:1.6;">
              The Local Post — Be the local authority.
            </p>
          </div>
        </div>
      `,
    });
    if (result.error) {
      console.error("[TEAM INVITE EMAIL] Resend error:", result.error);
      return false;
    }
    return true;
  } catch (emailError) {
    console.error("[TEAM INVITE EMAIL] Failed to send:", emailError);
    return false;
  }
}
