import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSyncFrequencyMinutes } from "@/lib/platform-config";
import { ensureConnectionPeriodForAccount } from "@/lib/impact-connection-periods";
import { syncSingleAccount } from "@/app/dashboard/integrations/actions";
import { generateImpactInsight } from "@/app/admin/impact/actions";

export const ANALYTICS_SYNC_BATCH_SIZE = 20;
export const ANALYTICS_SYNC_LEASE_MS = 10 * 60 * 1000;
export const DEFAULT_ANALYTICS_SYNC_FREQUENCY_MINUTES = 180;

const ELIGIBLE_STATUSES = ["ACTIVE", "TRIAL", "COMPED"] as const;

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function enqueueDueAnalyticsSyncJobs(options?: {
  limit?: number;
  source?: "SCHEDULED" | "MANUAL" | "CONNECTION" | "ADMIN";
  now?: Date;
}): Promise<number> {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? ANALYTICS_SYNC_BATCH_SIZE;
  const source = options?.source ?? "SCHEDULED";
  const configuredMinutes = await getSyncFrequencyMinutes();
  const frequencyMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : DEFAULT_ANALYTICS_SYNC_FREQUENCY_MINUTES;
  const staleBefore = new Date(now.getTime() - frequencyMinutes * 60 * 1000);

  const accounts = await prisma.zernioAccount.findMany({
    where: {
      user: {
        role: { not: "ADMIN" },
        accountStatus: { in: [...ELIGIBLE_STATUSES] },
      },
      OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: staleBefore } }],
    },
    orderBy: [{ lastSyncAt: "asc" }, { connectedAt: "asc" }],
    take: limit,
    select: {
      userId: true,
      platform: true,
      connectionPeriodId: true,
    },
  });

  let enqueued = 0;
  for (const account of accounts) {
    try {
      await prisma.analyticsSyncJob.create({
        data: {
          userId: account.userId,
          platform: account.platform,
          connectionPeriodId: account.connectionPeriodId,
          source,
          scheduledFor: now,
        },
      });
      enqueued++;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  return enqueued;
}

async function claimAnalyticsSyncJobs(options?: {
  batchSize?: number;
  leaseMs?: number;
  now?: Date;
}): Promise<{ ids: string[]; reclaimed: number }> {
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? ANALYTICS_SYNC_BATCH_SIZE;
  const leaseMs = options?.leaseMs ?? ANALYTICS_SYNC_LEASE_MS;
  const staleBefore = new Date(now.getTime() - leaseMs);
  const claimToken = randomUUID();

  const reclaimed = await prisma.analyticsSyncJob.updateMany({
    where: { status: "PROCESSING", claimedAt: { lt: staleBefore } },
    data: {
      status: "PENDING",
      claimToken: null,
      claimedAt: null,
      lastError: "Reclaimed from stale analytics sync lease",
    },
  });

  const candidates = await prisma.analyticsSyncJob.findMany({
    where: { status: "PENDING", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: batchSize,
    select: { id: true },
  });
  if (candidates.length === 0) return { ids: [], reclaimed: reclaimed.count };

  const ids = candidates.map((candidate) => candidate.id);
  await prisma.analyticsSyncJob.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: {
      status: "PROCESSING",
      claimToken,
      claimedAt: now,
      startedAt: now,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  const claimed = await prisma.analyticsSyncJob.findMany({
    where: { claimToken, status: "PROCESSING" },
    select: { id: true },
  });
  return { ids: claimed.map((job) => job.id), reclaimed: reclaimed.count };
}

async function processAnalyticsSyncJob(jobId: string, now: Date): Promise<boolean> {
  const job = await prisma.analyticsSyncJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "PROCESSING") return false;

  const account = await prisma.zernioAccount.findUnique({
    where: { userId_platform: { userId: job.userId, platform: job.platform } },
  });

  if (!account) {
    await prisma.analyticsSyncJob.updateMany({
      where: { id: job.id, status: "PROCESSING", claimToken: job.claimToken },
      data: {
        status: "FAILED",
        completedAt: now,
        lastError: "Connected account no longer exists",
      },
    });
    return false;
  }

  await ensureConnectionPeriodForAccount(account);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - 90);
  const result = await syncSingleAccount(
    job.userId,
    {
      zernioAccountId: account.zernioAccountId,
      platform: account.platform,
      zernioProfileId: account.zernioProfileId,
    },
    startDate.toISOString().split("T")[0],
    now.toISOString().split("T")[0]
  );

  const succeeded = result.analyticsSucceeded && result.followerStatsSucceeded;
  if (succeeded) {
    await prisma.zernioAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: now },
    });
  }

  await prisma.analyticsSyncJob.updateMany({
    where: { id: job.id, status: "PROCESSING", claimToken: job.claimToken },
    data: {
      status: succeeded ? "SUCCEEDED" : "FAILED",
      completedAt: now,
      postsSynced: result.syncedPosts,
      analyticsSucceeded: result.analyticsSucceeded,
      followerStatsSucceeded: result.followerStatsSucceeded,
      lastError: succeeded ? null : "One or more analytics endpoints failed",
    },
  });

  return succeeded;
}

export async function runAnalyticsSyncPass(options?: {
  batchSize?: number;
  now?: Date;
}): Promise<{ enqueued: number; processed: number; reclaimed: number }> {
  const now = options?.now ?? new Date();
  const enqueued = await enqueueDueAnalyticsSyncJobs({
    limit: options?.batchSize,
    now,
  });
  const claimed = await claimAnalyticsSyncJobs({
    batchSize: options?.batchSize,
    now,
  });

  let freshData = false;
  for (const id of claimed.ids) {
    const claimedJob = await prisma.analyticsSyncJob.findUnique({
      where: { id },
      select: { claimToken: true },
    });
    try {
      freshData = (await processAnalyticsSyncJob(id, now)) || freshData;
    } catch (error) {
      if (claimedJob?.claimToken) {
        await prisma.analyticsSyncJob.updateMany({
          where: { id, status: "PROCESSING", claimToken: claimedJob.claimToken },
          data: {
            status: "FAILED",
            completedAt: now,
            lastError: error instanceof Error ? error.message.slice(0, 2000) : "Analytics sync failed",
          },
        });
      }
    }
  }

  if (freshData) {
    try {
      await generateImpactInsight({ systemToken: process.env.CRON_SECRET });
    } catch (error) {
      console.error("[IMPACT] Automatic insight generation failed:", error);
    }
  }

  return {
    enqueued,
    processed: claimed.ids.length,
    reclaimed: claimed.reclaimed,
  };
}
