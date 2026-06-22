"use server";

import { randomBytes } from "crypto";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function createInviteLink(email: string): Promise<{ url: string; error?: string } | { error: string }> {
  if (!email || !email.includes("@")) {
    return { error: "A valid email address is required." };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  try {
    await prisma.inviteToken.upsert({
      where: { email },
      update: { token, expiresAt },
      create: { email, token, expiresAt },
    });
  } catch {
    return { error: "Failed to create invite token. Please try again." };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/register?token=${token}`;

  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    const result = await resend.emails.send({
      from: `Core OS <${fromAddress}>`,
      to: email,
      subject: "You've been invited to Core OS",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#e8e8e8;border-radius:12px;overflow:hidden;">
          <div style="background:#0a0a0a;padding:32px 32px 24px;border-bottom:1px solid #1a1a1a;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#e8e8e8;">Core OS</p>
            <p style="margin:4px 0 0;font-size:11px;font-weight:600;color:#c8952a;letter-spacing:0.1em;text-transform:uppercase;">Client Invitation</p>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e8e8e8;">You&apos;re Invited</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#787878;line-height:1.6;">
              You&apos;ve been invited to join Core OS. Click the button below to create your account and get started.
            </p>
            <a href="${url}" style="display:inline-block;padding:12px 28px;background:#c8952a;color:#0a0a0a;font-weight:600;font-size:14px;text-decoration:none;border-radius:8px;">
              Create Your Account
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#3a3a3a;line-height:1.6;">
              This link expires in 7 days and can only be used once.<br/>
              If you weren&apos;t expecting this invite, you can safely ignore this email.
            </p>
          </div>
        </div>
      `,
    });
    if (result.error) {
      console.error("[INVITE] Resend error:", result.error);
      return { error: `Email failed to send: ${result.error.message}. Copy the link manually.`, url };
    }
  } catch (emailError) {
    console.error("[INVITE] Failed to send email:", emailError);
    return { error: "Email failed to send. Copy the link below to share manually.", url };
  }

  return { url };
}
