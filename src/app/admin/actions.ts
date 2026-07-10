"use server";

import { randomBytes } from "crypto";
import { Resend } from "resend";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import type { UserPlan } from "@/lib/tiers";

function generateRandomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password: string;
  do {
    const bytes = randomBytes(12);
    password = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  } while (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password));
  return password;
}

async function sendOnboardingEmail(email: string): Promise<boolean> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({ where: { email } });
  await prisma.passwordResetToken.create({
    data: { email, token, expiresAt },
  });

  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const loginUrl = `${baseUrl}/login`;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: email,
      subject: "Welcome to The Local Post — Set Your Password",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#FFFFFF;color:#101418;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <div style="background:#F7F9FC;padding:32px 32px 24px;border-bottom:1px solid #E2E8F0;text-align:center;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:#101418;letter-spacing:-0.02em;">The Local Post</p>
            <p style="margin:6px 0 0;font-size:11px;font-weight:600;color:#1E56D6;letter-spacing:0.12em;text-transform:uppercase;">Your Town. Your Post.</p>
          </div>
          <div style="padding:32px;">
            <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#101418;">Welcome to The Local Post</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#5B6472;line-height:1.6;">
              Your account is ready. Click the button below to set your password and sign in.
            </p>

            <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#1E56D6;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;border-radius:6px;margin-bottom:16px;">Set Your Password</a>

            <p style="margin:12px 0 0;font-size:12px;color:#5B6472;line-height:1.6;">
              This link expires in 24 hours. After setting your password, you can sign in at
              <a href="${loginUrl}" style="color:#1E56D6;text-decoration:underline;">${loginUrl}</a>.
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
      console.error("[ONBOARDING EMAIL] Resend error:", result.error);
      return false;
    }
    return true;
  } catch (emailError) {
    console.error("[ONBOARDING EMAIL] Failed to send:", emailError);
    return false;
  }
}

export async function createClientProfile(email: string, plan?: UserPlan): Promise<{ password: string; error?: string } | { error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { error: "Unauthorized" };
  }

  if (!email || !email.includes("@")) {
    return { error: "A valid email address is required." };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const invitePlan = plan ?? "CALENDAR_ONLY";

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const password = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(password, 12);

  try {
    await prisma.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        role: "USER",
        plan: invitePlan,
      },
    });
  } catch {
    return { error: "Failed to create account. Please try again." };
  }

  const emailSent = await sendOnboardingEmail(normalizedEmail);

  return { password, error: emailSent ? undefined : "Account created, but welcome email failed to send. Share credentials manually." };
}

export async function updateUserPlan(
  userId: string,
  plan: UserPlan
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const validPlans: UserPlan[] = ["CALENDAR_ONLY", "CREATOR", "PRO"];
  if (!validPlans.includes(plan)) {
    return { success: false, error: "Invalid plan" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { plan },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update plan" };
  }
}

export async function updateUserRole(
  userId: string,
  role: "USER" | "ADMIN"
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update role" };
  }
}

export interface PendingInvite {
  id: string;
  email: string;
  plan: UserPlan;
  expiresAt: string;
  createdAt: string;
}

export async function getPendingInvites(): Promise<PendingInvite[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return [];
  }

  const invites = await prisma.inviteToken.findMany({
    orderBy: { createdAt: "desc" },
  });

  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    plan: (i.plan ?? "CALENDAR_ONLY") as UserPlan,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  }));
}

export interface BulkInviteResult {
  email: string;
  success: boolean;
  error?: string;
  password?: string;
}

export async function bulkCreateInvites(
  rawEmails: string,
  plan: UserPlan
): Promise<{ results: BulkInviteResult[]; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { results: [], error: "Unauthorized" };
  }

  const validPlans: UserPlan[] = ["CALENDAR_ONLY", "CREATOR", "PRO"];
  if (!validPlans.includes(plan)) {
    return { results: [], error: "Invalid plan" };
  }

  const emails = rawEmails
    .split(/[,\n\s]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (emails.length === 0) {
    return { results: [], error: "No email addresses provided." };
  }

  const results: BulkInviteResult[] = [];

  for (const email of emails) {
    if (!email.includes("@") || !email.includes(".")) {
      results.push({ email, success: false, error: "Invalid email format" });
      continue;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      results.push({ email, success: false, error: "Account already exists" });
      continue;
    }

    const password = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    try {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: "USER",
          plan,
        },
      });
      const emailSent = await sendOnboardingEmail(email);
      results.push({ email, success: true, password, error: emailSent ? undefined : "Welcome email failed — share credentials manually" });
    } catch {
      results.push({ email, success: false, error: "Failed to create account" });
    }
  }

  return { results };
}

export async function updateInvitePlan(
  inviteId: string,
  plan: UserPlan
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const validPlans: UserPlan[] = ["CALENDAR_ONLY", "CREATOR", "PRO"];
  if (!validPlans.includes(plan)) {
    return { success: false, error: "Invalid plan" };
  }

  try {
    await prisma.inviteToken.update({
      where: { id: inviteId },
      data: { plan },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update invite plan" };
  }
}

export async function deleteInvite(
  inviteId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.inviteToken.delete({ where: { id: inviteId } });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete invite" };
  }
}

export async function deleteUser(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (session.user.id === userId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    return { success: true };
  } catch (err) {
    console.error("[ADMIN DELETE USER] Error:", err);
    return { success: false, error: "Failed to delete user." };
  }
}

export async function adminResetPassword(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.email) {
    return { success: false, error: "User not found or has no email." };
  }

  const email = user.email;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.passwordResetToken.deleteMany({ where: { email } });
  await prisma.passwordResetToken.create({
    data: { email, token, expiresAt },
  });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: `The Local Post <${fromAddress}>`,
      to: email,
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
              An administrator has initiated a password reset for your account. Click the button below to choose a new password.
            </p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#1E56D6;color:#FFFFFF;font-weight:600;font-size:14px;text-decoration:none;border-radius:6px;">
              Reset Password
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#5B6472;line-height:1.6;">
              This link expires in 24 hours.<br/>
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
      console.error("[ADMIN RESET] Resend error:", result.error);
      return { success: false, error: "Failed to send reset email. Please try again." };
    }
  } catch (emailError) {
    console.error("[ADMIN RESET] Failed to send email:", emailError);
    return { success: false, error: "Failed to send reset email. Please try again." };
  }

  return { success: true };
}
