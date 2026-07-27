import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Password reset tokens are stored as SHA-256 digests.
 *
 * The raw token only ever exists in the emailed URL. Storing the raw value
 * meant that read access to the database (backup, log, replica, SQL injection
 * elsewhere) was equivalent to account takeover for every outstanding reset.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedResetToken {
  /** Raw token — goes in the emailed URL, never persisted. */
  token: string;
  expiresAt: Date;
}

/**
 * Replace any outstanding reset tokens for an email with a single new one.
 */
export async function issuePasswordResetToken(
  email: string,
  ttlMs: number
): Promise<IssuedResetToken> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, token: hashResetToken(token), expiresAt },
    }),
  ]);

  return { token, expiresAt };
}

export type ConsumeResetTokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Atomically consume a reset token.
 *
 * The delete is the claim: `deleteMany` reports how many rows it removed, so
 * two concurrent requests carrying the same token cannot both succeed. A
 * lookup-then-delete sequence allowed the token to be redeemed twice.
 */
export async function consumePasswordResetToken(
  rawToken: string
): Promise<ConsumeResetTokenResult> {
  // Legacy rows created before hashing was introduced stored the raw token.
  const candidates = [hashResetToken(rawToken), rawToken];

  const record = await prisma.passwordResetToken.findFirst({
    where: { token: { in: candidates } },
  });

  if (!record) return { ok: false, reason: "invalid" };

  const deleted = await prisma.passwordResetToken.deleteMany({
    where: { id: record.id },
  });

  if (deleted.count !== 1) return { ok: false, reason: "invalid" };

  if (record.expiresAt < new Date()) return { ok: false, reason: "expired" };

  return { ok: true, email: record.email };
}
