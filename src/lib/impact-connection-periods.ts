import { prisma } from "@/lib/prisma";

interface CurrentAccount {
  id: string;
  userId: string;
  platform: string;
  connectedAt: Date;
  zernioAccountId: string;
  connectionPeriodId: string | null;
}

function normalizePlatform(platform: string): string {
  return platform.toLowerCase();
}

export async function ensureConnectionPeriodForAccount(
  account: CurrentAccount
): Promise<{ id: string; connectedAt: Date }> {
  const platform = normalizePlatform(account.platform);

  if (account.connectionPeriodId) {
    const period = await prisma.impactConnectionPeriod.update({
      where: { id: account.connectionPeriodId },
      data: {
        platform,
        providerAccountId: account.zernioAccountId,
        disconnectedAt: null,
      },
      select: { id: true, connectedAt: true },
    });
    return period;
  }

  const existing = await prisma.impactConnectionPeriod.findFirst({
    where: {
      userId: account.userId,
      platform,
      disconnectedAt: null,
    },
    orderBy: { connectedAt: "desc" },
    select: { id: true, connectedAt: true },
  });

  const period = existing ?? (await prisma.impactConnectionPeriod.create({
    data: {
      userId: account.userId,
      platform,
      connectedAt: account.connectedAt,
      providerAccountId: account.zernioAccountId,
    },
    select: { id: true, connectedAt: true },
  }));

  await prisma.zernioAccount.update({
    where: { id: account.id },
    data: { connectionPeriodId: period.id },
  });

  return period;
}

export async function closeConnectionPeriodForAccount(account: {
  userId: string;
  platform: string;
  connectionPeriodId?: string | null;
}): Promise<void> {
  if (account.connectionPeriodId) {
    await prisma.impactConnectionPeriod.updateMany({
      where: { id: account.connectionPeriodId, disconnectedAt: null },
      data: { disconnectedAt: new Date() },
    });
    return;
  }

  await prisma.impactConnectionPeriod.updateMany({
    where: {
      userId: account.userId,
      platform: normalizePlatform(account.platform),
      disconnectedAt: null,
    },
    data: { disconnectedAt: new Date() },
  });
}

export async function closeConnectionPeriodsForUser(userId: string): Promise<void> {
  await prisma.impactConnectionPeriod.updateMany({
    where: { userId, disconnectedAt: null },
    data: { disconnectedAt: new Date() },
  });
}
