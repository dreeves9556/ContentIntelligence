import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const CONNECTION_STATE_TTL_MS = 10 * 60 * 1000;

function hashState(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createIntegrationConnectionState(input: {
  userId: string;
  platform: string;
  profileId: string;
}): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  await prisma.$transaction([
    prisma.integrationConnectionState.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { userId: input.userId, consumedAt: { not: null } },
        ],
      },
    }),
    prisma.integrationConnectionState.create({
      data: {
        tokenHash: hashState(token),
        userId: input.userId,
        platform: input.platform,
        profileId: input.profileId,
        expiresAt: new Date(now.getTime() + CONNECTION_STATE_TTL_MS),
      },
    }),
  ]);

  return token;
}

export async function consumeIntegrationConnectionState(
  token: string,
  userId: string
): Promise<{ platform: string; profileId: string } | null> {
  const tokenHash = hashState(token);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const consumed = await tx.integrationConnectionState.updateMany({
      where: {
        tokenHash,
        userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) return null;

    const state = await tx.integrationConnectionState.findUnique({
      where: { tokenHash },
      select: { platform: true, profileId: true },
    });

    return state;
  });
}
