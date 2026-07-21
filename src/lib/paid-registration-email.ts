import { Resend } from "resend";

interface PaidRegistrationEmailParams {
  email: string;
  registerUrl: string;
  purchaseType: "solo" | "community";
  organizationName?: string;
}

/**
 * Send a paid membership registration email to a user who purchased
 * via the public homepage but doesn't have an account yet.
 * Returns true on success, false on failure.
 */
export async function sendPaidMembershipRegistrationEmail({
  email,
  registerUrl,
  purchaseType,
  organizationName,
}: PaidRegistrationEmailParams): Promise<boolean> {
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const isCommunity = purchaseType === "community";
  const heading = isCommunity
    ? organizationName
      ? `Your ${organizationName} community membership is ready.`
      : "Your Communities membership is ready."
    : "Your Solo membership is ready.";

  const subtext = isCommunity
    ? "Create your admin account to set up your team, invite members, and start generating content."
    : "Create your account to access your AI content calendar, brand brain, and analytics dashboard.";

  const subject = isCommunity
    ? "Finish setting up your Local Post community"
    : "Finish setting up your Local Post membership";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: email,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
            <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#1E56D6;letter-spacing:0.12em;text-transform:uppercase;">Your Town. Your Post.</p>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">${heading}</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#5B6472;line-height:1.6;">
              ${subtext} This registration link expires in 14 days.
            </p>

            <a href="${registerUrl}" style="display:inline-block;padding:12px 28px;background:#1E56D6;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;border-radius:6px;margin-bottom:16px;">Create Your Account</a>

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
      console.error("[PAID REGISTRATION EMAIL] Resend error:", result.error);
      return false;
    }
    return true;
  } catch (emailError) {
    console.error("[PAID REGISTRATION EMAIL] Failed to send:", emailError);
    return false;
  }
}
