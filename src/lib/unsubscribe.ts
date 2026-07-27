import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  const secret =
    process.env.UNSUBSCRIBE_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Unsubscribe secret is not configured");
  }
  return secret;
}

/**
 * Payload separator.
 *
 * A literal "." cannot be used: every real email address contains at least one
 * dot, so splitting the decoded payload on "." produced more than three parts
 * and every token failed verification. "|" is not valid in an email address
 * local part or domain, and user IDs are cuid/uuid values, so it cannot appear
 * in either field.
 */
const SEPARATOR = "|";

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function generateUnsubscribeToken(userId: string, email: string): string {
  const payload = `${userId}${SEPARATOR}${email}`;
  return Buffer.from(`${payload}${SEPARATOR}${sign(payload)}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(SEPARATOR);
    if (parts.length !== 3) return null;
    const [userId, email, signature] = parts;
    if (!userId || !email || !signature) return null;

    const expectedSignature = sign(`${userId}${SEPARATOR}${email}`);

    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (provided.length !== expected.length) return null;
    if (!timingSafeEqual(provided, expected)) return null;

    return { userId, email };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(userId: string, email: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const token = generateUnsubscribeToken(userId, email);
  return `${baseUrl}/unsubscribe?token=${token}`;
}
