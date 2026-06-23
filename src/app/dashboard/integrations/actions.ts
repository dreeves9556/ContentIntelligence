"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { zernio } from "@/lib/zernio";

export async function disconnectZernioAccount(platform: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const account = await prisma.zernioAccount.findUnique({
    where: { userId_platform: { userId: session.user.id, platform } },
  });

  if (account) {
    try {
      await zernio.accounts.delete(account.zernioAccountId);
    } catch {
      // Continue even if Zernio-side deletion fails
    }
    await prisma.zernioAccount.delete({
      where: { userId_platform: { userId: session.user.id, platform } },
    });
  }

  revalidatePath("/dashboard/integrations");
  return { success: true };
}

export async function syncAnalytics() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId: session.user.id },
  });

  if (zernioAccounts.length === 0) {
    return { success: false, message: "No connected accounts" };
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = now.toISOString().split("T")[0];

  let synced = 0;

  for (const account of zernioAccounts) {
    try {
      const analytics = await zernio.analytics.getForAccount(
        account.zernioAccountId,
        startStr,
        endStr
      );

      for (const post of analytics.posts ?? []) {
        const m = post.analytics;
        await prisma.postAnalytics.upsert({
          where: { externalId_userId: { externalId: post._id, userId: session.user.id } },
          update: {
            views: m.impressions ?? m.views ?? 0,
            likes: m.likes ?? 0,
            comments: m.comments ?? 0,
            postUrl: post.platformPostUrl ?? null,
          },
          create: {
            userId: session.user.id,
            externalId: post._id,
            title: post.content.slice(0, 120),
            format: (post.platform ?? account.platform).toUpperCase(),
            publishedAt: new Date(post.publishedAt),
            views: m.impressions ?? m.views ?? 0,
            likes: m.likes ?? 0,
            comments: m.comments ?? 0,
            postUrl: post.platformPostUrl ?? null,
          },
        });
        synced++;
      }
    } catch (err) {
      console.error(`Failed to sync analytics for ${account.platform}:`, err);
    }
  }

  revalidatePath("/dashboard");
  return { success: true, synced };
}
