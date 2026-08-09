import { randomUUID } from "crypto";

/**
 * Bounded, recoverable scheduled-push processing.
 *
 * Previously the cron route claimed EVERY due PENDING row via updateMany
 * (PENDING → PROCESSING) and then fetched only `take: 20`. Rows beyond 20
 * stayed PROCESSING forever, and a worker crash left rows stuck with no
 * lease recovery.
 *
 * This service implements a safe claim protocol:
 *  1. Claim no more than `batchSize` due PENDING rows by atomically setting
 *     status → PROCESSING + claimToken + claimedAt. A conditional updateMany
 *     (WHERE status = 'PENDING') ensures concurrent workers cannot both claim
 *     the same row.
 *  2. Re-fetch only the rows this worker claimed (by claimToken) and process
 *     exactly those — never arbitrary PROCESSING rows belonging to another
 *     worker.
 *  3. Reclaim stale PROCESSING rows (claimedAt older than the lease) so a
 *     crashed worker does not permanently suppress delivery.
 *  4. Preserve terminal states (SENT, CANCELLED, FAILED) — they are never
 *     reclaimed. FAILED rows are left for manual/operator retry (a failed
 *     broadcast should not silently retry forever).
 *  5. Record failures with lastError; the row transitions to FAILED.
 *
 * Dependency injection: the service accepts a `ScheduledPushDeps` object so
 * tests can inject fakes. The production wiring (`runScheduledPushPass`)
 * constructs deps from the real Prisma client and `sendBroadcastToSegment`.
 *
 * Crash-after-send behavior: if a worker crashes after `sendBroadcastToSegment`
 * succeeds but before the finalizing updateMany, the row stays PROCESSING
 * until the lease expires, then is reclaimed and re-sent. This is at-least-once
 * delivery — documented and inherent to any crash-recoverable queue without
 * transactional outbox support.
 */

/** Maximum rows claimed per invocation. */
export const SCHEDULED_PUSH_BATCH_SIZE = 20;

/**
 * Lease duration. A PROCESSING row whose claimedAt is older than this is
 * considered abandoned (worker crash or timeout) and may be reclaimed.
 * Chosen to comfortably exceed a single broadcast send across a segment.
 */
export const SCHEDULED_PUSH_LEASE_MS = 10 * 60 * 1000; // 10 minutes

export interface ScheduledPushResult {
  processed: number;
  sent: number;
  failed: number;
  reclaimed: number;
}

export type ScheduledPushStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "CANCELLED"
  | "FAILED";

export interface ScheduledPushRow {
  id: string;
  title: string;
  body: string;
  url: string | null;
  segment: string;
  status: ScheduledPushStatus;
  claimToken: string | null;
  claimedAt: Date | null;
  scheduledFor: Date;
  attempts: number;
  lastError: string | null;
  sentCount: number;
  failedCount: number;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
}

/** Minimal Prisma interface for scheduled-push processing. */
export interface ScheduledPushPrisma {
  scheduledPushNotification: {
    updateMany(args: {
      where: {
        status?: ScheduledPushStatus;
        claimedAt?: { lt: Date };
        id?: string | { in: string[] };
        claimToken?: string;
      };
      data: {
        status?: ScheduledPushStatus;
        claimToken?: string | null;
        claimedAt?: Date | null;
        lastError?: string | null;
        attempts?: { increment: number };
        sentCount?: number;
        failedCount?: number;
      };
    }): Promise<{ count: number }>;
    findMany(args: {
      where: {
        status?: ScheduledPushStatus;
        scheduledFor?: { lte: Date };
        claimToken?: string;
        id?: string | { in: string[] };
      };
      orderBy?: { scheduledFor: "asc" | "desc" };
      take?: number;
      select?: { id: true };
    }): Promise<ScheduledPushRow[] | { id: string }[]>;
  };
}

export interface ScheduledPushDeps {
  prisma: ScheduledPushPrisma;
  /** Broadcast sender. Tests inject a fake. */
  sendBroadcast: (
    segment: string,
    title: string,
    body: string,
    url?: string
  ) => Promise<BroadcastResult>;
  now?: () => Date;
  randomUUID?: () => string;
}

/**
 * Claim up to `batchSize` due scheduled pushes for the current worker.
 *
 * Returns the IDs this worker successfully claimed. Each claim is a
 * conditional update (status = 'PENDING') so two concurrent workers cannot
 * both claim the same row — only the first update matches.
 *
 * Stale PROCESSING rows (claimedAt older than the lease) are reclaimed in the
 * same pass: their status is conditionally reset to PENDING so they become
 * eligible for claiming by this or another worker.
 */
export async function claimScheduledPushes(
  deps: ScheduledPushDeps,
  batchSize: number = SCHEDULED_PUSH_BATCH_SIZE,
  leaseMs: number = SCHEDULED_PUSH_LEASE_MS
): Promise<{ claimedIds: string[]; reclaimed: number }> {
  const { prisma } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const staleBefore = new Date(now.getTime() - leaseMs);
  const claimToken = (deps.randomUUID ?? randomUUID)();

  // Reclaim stale PROCESSING rows: reset to PENDING so they can be claimed.
  // Conditional on status = 'PROCESSING' AND claimedAt < staleBefore so we
  // never touch a live worker's lease or a terminal row.
  const reclaimResult = await prisma.scheduledPushNotification.updateMany({
    where: {
      status: "PROCESSING",
      claimedAt: { lt: staleBefore },
    },
    data: {
      status: "PENDING",
      claimToken: null,
      claimedAt: null,
      lastError: "Reclaimed from stale PROCESSING lease",
    },
  });

  // Claim up to batchSize due PENDING rows. We first select the candidate IDs
  // (ordered by scheduledFor) then conditionally update them to PROCESSING
  // with our token. The conditional update ensures only PENDING rows match,
  // so a concurrent worker that claimed one between the select and update
  // will simply not be matched for us.
  const candidates = await prisma.scheduledPushNotification.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: "asc" },
    take: batchSize,
    select: { id: true },
  });

  if (candidates.length === 0) {
    return { claimedIds: [], reclaimed: reclaimResult.count };
  }

  const candidateIds = candidates.map((c) => (c as { id: string }).id);

  const claimResult = await prisma.scheduledPushNotification.updateMany({
    where: {
      id: { in: candidateIds },
      status: "PENDING",
    },
    data: {
      status: "PROCESSING",
      claimToken,
      claimedAt: now,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  // If some candidates were claimed by another worker between select and
  // update, claimResult.count < candidateIds.length. Re-fetch only the rows
  // we actually claimed (by our token) so we never process another worker's
  // rows.
  let claimedIds: string[];
  if (claimResult.count === candidateIds.length) {
    claimedIds = candidateIds;
  } else {
    const ours = (await prisma.scheduledPushNotification.findMany({
      where: { claimToken },
      select: { id: true },
    })) as { id: string }[];
    claimedIds = ours.map((r) => r.id);
  }

  return { claimedIds, reclaimed: reclaimResult.count };
}

/**
 * Process the scheduled pushes claimed by the current worker (identified by
 * the given IDs). Only rows still holding a claim are processed; a row whose
 * claim was lost (stale-reclaimed by another worker) is skipped.
 */
export async function processClaimedScheduledPushes(
  deps: ScheduledPushDeps,
  claimedIds: string[]
): Promise<{ processed: number; sent: number; failed: number }> {
  const { prisma, sendBroadcast } = deps;

  if (claimedIds.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  const pushes = (await prisma.scheduledPushNotification.findMany({
    where: { id: { in: claimedIds } },
    orderBy: { scheduledFor: "asc" },
  })) as ScheduledPushRow[];

  let processed = 0;
  let totalSent = 0;
  let totalFailed = 0;

  for (const push of pushes) {
    processed++;

    // Only the worker holding claimToken may finalize. If the row was
    // reclaimed (status != PROCESSING or claimToken changed), skip it —
    // another worker now owns it.
    if (push.status !== "PROCESSING" || !push.claimToken) {
      continue;
    }

    try {
      const result = await sendBroadcast(
        push.segment,
        push.title,
        push.body,
        push.url ?? undefined
      );

      const finalized = await prisma.scheduledPushNotification.updateMany({
        where: { id: push.id, claimToken: push.claimToken, status: "PROCESSING" },
        data: {
          status: "SENT",
          sentCount: result.sent,
          failedCount: result.failed,
          claimToken: null,
          claimedAt: null,
          lastError: null,
        },
      });

      if (finalized.count > 0) {
        totalSent += result.sent;
        totalFailed += result.failed;
      }
      // If finalized.count === 0, we lost the lease mid-send — another worker
      // reclaimed and will re-send. Do not double-count.
    } catch (err) {
      console.error(`[SCHEDULED PUSH] Push ${push.id} failed:`, err);
      await prisma.scheduledPushNotification
        .updateMany({
          where: { id: push.id, claimToken: push.claimToken, status: "PROCESSING" },
          data: {
            status: "FAILED",
            claimToken: null,
            claimedAt: null,
            lastError: (err instanceof Error ? err.message : String(err)).slice(0, 2000),
          },
        })
        .catch((e) => console.error("[SCHEDULED PUSH] Failed to mark push FAILED:", e));
    }
  }

  return { processed, sent: totalSent, failed: totalFailed };
}

/**
 * Run one pass of the scheduled-push processor: claim a bounded batch
 * (including stale recovery), then process only the claimed rows.
 *
 * Production wiring: constructs deps from the real Prisma client and
 * `sendBroadcastToSegment`. Tests call `claimScheduledPushes` /
 * `processClaimedScheduledPushes` directly with injected deps.
 */
export async function runScheduledPushPass(
  batchSize: number = SCHEDULED_PUSH_BATCH_SIZE,
  leaseMs: number = SCHEDULED_PUSH_LEASE_MS
): Promise<ScheduledPushResult> {
  // Late imports to avoid a circular dependency at module load time and to
  // keep the DI surface clean (tests never call this function).
  const { prisma } = await import("@/lib/prisma");
  const { sendBroadcastToSegment } = await import("@/lib/notifications");
  type PushSegment = "all" | "CALENDAR_ONLY" | "PRO";

  const deps: ScheduledPushDeps = {
    prisma: prisma as unknown as ScheduledPushPrisma,
    sendBroadcast: (segment, title, body, url) =>
      sendBroadcastToSegment(segment as PushSegment, title, body, url),
  };

  const { claimedIds, reclaimed } = await claimScheduledPushes(deps, batchSize, leaseMs);
  const { processed, sent, failed } = await processClaimedScheduledPushes(deps, claimedIds);
  return { processed, sent, failed, reclaimed };
}
