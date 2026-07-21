import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_SERIALIZABLE_RETRIES = 3;

function storageKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function serializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 0; attempt < MAX_SERIALIZABLE_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" || error.code === "P2002");
      if (!retryable || attempt === MAX_SERIALIZABLE_RETRIES - 1) throw error;
    }
  }
  throw new Error("Rate-limit transaction retry exhausted");
}

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const now = new Date();
  const entry = await prisma.rateLimitBucket.findUnique({
    where: { key: storageKey(key) },
    select: { lockedUntil: true },
  });

  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterMs: entry.lockedUntil.getTime() - now.getTime(),
    };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(
  key: string,
  maxAttempts: number,
  lockoutMs: number
): Promise<{ lockedOut: boolean; retryAfterMs?: number }> {
  const hashedKey = storageKey(key);

  return serializableTransaction(async (tx) => {
    const now = new Date();
    const entry = await tx.rateLimitBucket.findUnique({
      where: { key: hashedKey },
    });

    if (entry?.lockedUntil && entry.lockedUntil > now) {
      return {
        lockedOut: true,
        retryAfterMs: entry.lockedUntil.getTime() - now.getTime(),
      };
    }

    const windowExpired =
      !entry || now.getTime() - entry.windowStart.getTime() >= lockoutMs;
    const count = windowExpired ? 1 : entry.count + 1;
    const lockedUntil =
      count >= maxAttempts ? new Date(now.getTime() + lockoutMs) : null;

    await tx.rateLimitBucket.upsert({
      where: { key: hashedKey },
      create: {
        key: hashedKey,
        count,
        windowStart: now,
        lockedUntil,
      },
      update: {
        count,
        windowStart: windowExpired ? now : entry.windowStart,
        lockedUntil,
      },
    });

    return lockedUntil
      ? { lockedOut: true, retryAfterMs: lockoutMs }
      : { lockedOut: false };
  });
}

export async function clearRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({
    where: { key: storageKey(key) },
  });
}

export async function checkActionRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const hashedKey = storageKey(key);

  return serializableTransaction(async (tx) => {
    const now = new Date();
    const entry = await tx.rateLimitBucket.findUnique({
      where: { key: hashedKey },
    });

    const windowExpired =
      !entry || now.getTime() - entry.windowStart.getTime() >= windowMs;
    const count = windowExpired ? 1 : entry.count + 1;
    const windowStart = windowExpired ? now : entry.windowStart;

    await tx.rateLimitBucket.upsert({
      where: { key: hashedKey },
      create: {
        key: hashedKey,
        count,
        windowStart,
      },
      update: {
        count,
        windowStart,
        lockedUntil: null,
      },
    });

    if (count > maxRequests) {
      return {
        allowed: false,
        retryAfterMs: Math.max(
          0,
          windowMs - (now.getTime() - windowStart.getTime())
        ),
      };
    }

    return { allowed: true };
  });
}

export function formatRetryTime(ms: number): string {
  const minutes = Math.ceil(ms / (60 * 1000));
  if (minutes >= 60) {
    const hours = Math.ceil(minutes / 60);
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
