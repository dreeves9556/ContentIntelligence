import { createHmac } from "crypto";

function getSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET ?? process.env.NEXTAUTH_SECRET ?? "fallback-unsubscribe-secret";
}

export function generateUnsubscribeToken(userId: string, email: string): string {
  const payload = `${userId}.${email}`;
  const signature = createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return null;
    const [userId, email, signature] = parts;

    const expectedSignature = createHmac("sha256", getSecret())
      .update(`${userId}.${email}`)
      .digest("hex");

    if (signature !== expectedSignature) return null;

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
