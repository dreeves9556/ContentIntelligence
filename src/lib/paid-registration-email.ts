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

  const features = isCommunity
    ? [
        { icon: "👥", title: "Team Management", desc: "Invite your team and manage seats" },
        { icon: "📅", title: "AI Content Calendar", desc: "Weekly posts tailored to your brand" },
        { icon: "📊", title: "Analytics Dashboard", desc: "Track performance across platforms" },
        { icon: "🎯", title: "Brand Brain", desc: "AI trained on your voice and audience" },
      ]
    : [
        { icon: "📅", title: "AI Content Calendar", desc: "Weekly posts tailored to your brand" },
        { icon: "🎯", title: "Brand Brain", desc: "AI trained on your voice and audience" },
        { icon: "📊", title: "Analytics Dashboard", desc: "Track performance across platforms" },
        { icon: "🔗", title: "Social Integrations", desc: "Connect Instagram, YouTube, LinkedIn & more" },
      ];

  const featuresHtml = features
    .map(
      (f) => `
        <tr>
          <td style="padding:12px 0;vertical-align:top;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="width:40px;vertical-align:top;padding-right:12px;">
                  <div style="width:36px;height:36px;background:#F7F9FC;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:36px;text-align:center;">${f.icon}</div>
                </td>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#101418;">${f.title}</p>
                  <p style="margin:2px 0 0;font-size:13px;color:#5B6472;line-height:1.5;">${f.desc}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `
    )
    .join("");

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin:0;padding:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#F7F9FC;">
            <tr>
              <td align="center" style="padding:24px 16px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#1E56D6 0%,#1744A8 100%);padding:40px 32px 36px;text-align:center;">
                      <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;">The Local Post</p>
                      <p style="margin:8px 0 0;font-size:11px;font-weight:600;color:#A8C7F0;letter-spacing:0.14em;text-transform:uppercase;">Your Town. Your Post.</p>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px 32px 24px;">
                      <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;line-height:1.3;">${heading}</h1>
                      <p style="margin:0 0 28px;font-size:15px;color:#5B6472;line-height:1.65;">
                        ${subtext}
                      </p>

                      <!-- Trial badge -->
                      <div style="background:#F0F5FF;border:1px solid #D6E4FF;border-radius:8px;padding:14px 18px;margin-bottom:28px;">
                        <p style="margin:0;font-size:13px;color:#1744A8;line-height:1.5;">
                          <strong>7-Day Free Trial Active</strong> — Your trial ends on ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. No charge until then.
                        </p>
                      </div>

                      <!-- CTA -->
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:16px;">
                        <tr>
                          <td align="center">
                            <a href="${registerUrl}" style="display:inline-block;padding:16px 40px;background:#1E56D6;color:#FFFFFF;font-weight:700;font-size:15px;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">Create Your Account &rarr;</a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 32px;font-size:12px;color:#8B95A3;line-height:1.6;text-align:center;">
                        Link expires in 14 days. If the button doesn't work, copy and paste this URL:<br/>
                        <a href="${registerUrl}" style="color:#1E56D6;text-decoration:underline;word-break:break-all;font-size:11px;">${registerUrl}</a>
                      </p>

                      <!-- Divider -->
                      <hr style="border:none;border-top:1px solid #E2E8F0;margin:0 0 28px;" />

                      <!-- Features -->
                      <p style="margin:0 0 16px;font-size:12px;font-weight:700;color:#8B95A3;letter-spacing:0.08em;text-transform:uppercase;">What's Included</p>
                      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                        ${featuresHtml}
                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background:#F7F9FC;padding:24px 32px;border-top:1px solid #E2E8F0;">
                      <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;color:#101418;text-align:center;">The Local Post</p>
                      <p style="margin:0;font-size:11px;color:#8B95A3;text-align:center;line-height:1.6;">
                        Be the local authority.<br/>
                        <a href="https://www.thelocalpost.app" style="color:#1E56D6;text-decoration:none;">thelocalpost.app</a>
                      </p>
                    </td>
                  </tr>

                </table>
                <p style="margin:16px 0 0;font-size:11px;color:#8B95A3;text-align:center;line-height:1.5;">
                  You're receiving this email because you started a Local Post membership.<br/>
                  If you didn't create this account, please ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
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
