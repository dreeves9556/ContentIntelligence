import { prisma } from "@/lib/prisma";
import { zernio } from "@/lib/zernio";
import { closeConnectionPeriodsForUser } from "@/lib/impact-connection-periods";

/**
 * Sever all Zernio social-account connections for a user.
 *
 * Deletes each account on Zernio's side (best-effort — errors are logged
 * but don't block) and then removes all ZernioAccount rows from our DB.
 *
 * Used when a subscription is canceled (trial expiry, non-payment, or
 * voluntary cancellation) to fully revoke social-media integrations.
 */
export async function severZernioForUser(userId: string): Promise<void> {
  const accounts = await prisma.zernioAccount.findMany({
    where: { userId },
    select: { zernioAccountId: true, platform: true },
  });

  if (accounts.length === 0) return;

  const BATCH_SIZE = 5;
  for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
    const batch = accounts.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map(async (acc) => {
        try {
          await zernio.accounts.delete(acc.zernioAccountId);
          console.log(`[ZERNIO SEVER] Deleted ${acc.platform} account ${acc.zernioAccountId} for user ${userId}`);
        } catch (err) {
          console.error(`[ZERNIO SEVER] Failed to delete ${acc.platform} account ${acc.zernioAccountId}:`, err);
        }
      })
    );
  }

  await closeConnectionPeriodsForUser(userId);
  await prisma.zernioAccount.deleteMany({ where: { userId } });
  console.log(`[ZERNIO SEVER] Removed ${accounts.length} ZernioAccount rows for user ${userId}`);
}
