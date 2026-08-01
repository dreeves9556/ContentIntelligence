/**
 * Re-send welcome / password-setup emails to users whose initial token expired.
 *
 * When an admin creates a client account, a "Set Your Password" email is sent
 * with a token. If the user never clicks it, the token expires and they're
 * locked out of their account (the password is a random hash they don't know).
 *
 * This script finds all expired, unconsumed PasswordResetToken rows, issues
 * fresh tokens with a 7-day TTL, and re-sends the welcome email.
 *
 * Usage:
 *   npx tsx scripts/resend-expired-welcome-emails.ts              # dry-run (list only)
 *   npx tsx scripts/resend-expired-welcome-emails.ts --send       # actually send emails
 *
 * Requires .env.local with DATABASE_URL, RESEND_API_KEY,
 * RESEND_FROM_EMAIL, and NEXT_PUBLIC_APP_URL.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createHash, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { Resend } from "resend";

// ─── Env loading ───────────────────────────────────────────────────────────

function loadEnv() {
  for (const filename of [".env.local", ".env.stripe.generated"]) {
    const envPath = resolve(process.cwd(), filename);
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    } catch {
      // file not found — skip
    }
  }
}

loadEnv();

const DO_SEND = process.argv.includes("--send");
const WELCOME_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY!);
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const fromAddress = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

// ─── Token helpers (mirrors lib/password-reset-tokens.ts) ──────────────────

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + WELCOME_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, token: hashResetToken(token), expiresAt },
    }),
  ]);

  return token;
}

// ─── Email (mirrors sendOnboardingEmail in admin/actions.ts) ───────────────

async function sendWelcomeEmail(email: string, resetUrl: string): Promise<boolean> {
  const loginUrl = `${baseUrl}/login`;
  try {
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
              This link expires in 7 days. After setting your password, you can sign in at
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
      console.error("  Resend error:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("  Failed to send:", err);
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`=== Resend expired welcome emails ===`);
  console.log(`Mode: ${DO_SEND ? "SEND (live)" : "DRY RUN (no emails sent)"}`);
  console.log(`Token TTL: 7 days`);
  console.log();

  // Find all expired, unconsumed password reset tokens.
  // consumePasswordResetToken deletes the row on use, so any remaining row
  // with expiresAt < now was issued but never acted on.
  const expiredTokens = await prisma.passwordResetToken.findMany({
    where: { expiresAt: { lt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (expiredTokens.length === 0) {
    console.log("No expired tokens found. Nothing to do.");
    return;
  }

  console.log(`Found ${expiredTokens.length} expired token(s).`);
  console.log();

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of expiredTokens) {
    const email = row.email;

    // Verify the user exists — a token without a matching user is stale.
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  SKIP  ${email} — no User row found (stale token)`);
      skipped++;
      continue;
    }

    // Skip users who have already set up their account (have questionnaires
    // or calendars — strong signal they've logged in and used the product).
    const [qCount, cCount] = await Promise.all([
      prisma.questionnaire.count({ where: { userId: user.id } }),
      prisma.calendar.count({ where: { userId: user.id } }),
    ]);
    if (qCount > 0 || cCount > 0) {
      console.log(`  SKIP  ${email} — user has activity (${qCount} questionnaires, ${cCount} calendars)`);
      skipped++;
      continue;
    }

    console.log(`  ${DO_SEND ? "SEND" : "DRY"}  ${email}  (token created ${row.createdAt.toISOString()})`);

    if (!DO_SEND) {
      continue;
    }

    // Issue a fresh 7-day token (this also deletes the old expired one).
    const token = await issueToken(email);
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const ok = await sendWelcomeEmail(email, resetUrl);

    if (ok) {
      sent++;
    } else {
      failed++;
    }
  }

  console.log();
  console.log(`Summary: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  if (!DO_SEND) {
    console.log();
    console.log("This was a dry run. To actually send emails, re-run with --send:");
    console.log("  npx tsx scripts/resend-expired-welcome-emails.ts --send");
  }
}

main()
  .catch((err) => {
    console.error("Script failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
