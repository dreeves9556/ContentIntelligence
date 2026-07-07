"use server";

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, recordFailedAttempt } from "@/lib/rate-limiter";

const RESET_MAX_ATTEMPTS = 3;
const RESET_LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!email || !email.includes("@")) {
    return { success: false, error: "Please enter a valid email address." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rateLimitKey = `reset:${normalizedEmail}`;

  const rateCheck = checkRateLimit(rateLimitKey, RESET_MAX_ATTEMPTS, RESET_LOCKOUT_MS);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many reset requests. Please try again in ${Math.ceil(rateCheck.retryAfterMs! / (60 * 1000))} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Don't reveal whether the email exists — always return success
  if (!user || !user.password) {
    recordFailedAttempt(rateLimitKey, RESET_MAX_ATTEMPTS, RESET_LOCKOUT_MS);
    return { success: true };
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Delete any existing tokens for this email, then create a new one
  await prisma.passwordResetToken.deleteMany({
    where: { email: normalizedEmail },
  });

  await prisma.passwordResetToken.create({
    data: { email: normalizedEmail, token, expiresAt },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: normalizedEmail,
      subject: "Reset your The Local Post password",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
            <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#1E56D6;letter-spacing:0.12em;text-transform:uppercase;">Password Reset</p>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">Reset Your Password</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#5B6472;line-height:1.6;">
              We received a request to reset your password. Click the button below to choose a new password.
            </p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#1E56D6;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;border-radius:6px;">
              Reset Password
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#5B6472;line-height:1.6;">
              This link expires in 1 hour.<br/>
              If you didn&apos;t request a password reset, you can safely ignore this email.
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
      console.error("[PASSWORD RESET] Resend error:", result.error);
      return { success: false, error: "Failed to send reset email. Please try again." };
    }
  } catch (emailError) {
    console.error("[PASSWORD RESET] Failed to send email:", emailError);
    return { success: false, error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}

export async function resetPassword(
  token: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) {
    return { success: false, error: "Invalid reset link." };
  }

  if (!password || password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { success: false, error: "Password must include at least one letter and one number." };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
  });

  if (!resetToken) {
    return { success: false, error: "This reset link is invalid or has already been used." };
  }

  if (resetToken.expiresAt < new Date()) {
    await prisma.passwordResetToken.delete({ where: { token } });
    return { success: false, error: "This reset link has expired." };
  }

  const user = await prisma.user.findUnique({
    where: { email: resetToken.email },
  });

  if (!user) {
    return { success: false, error: "No account found for this email." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { email: resetToken.email },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
  });

  // Delete the token so it can't be reused
  await prisma.passwordResetToken.delete({ where: { token } });

  return { success: true };
}
