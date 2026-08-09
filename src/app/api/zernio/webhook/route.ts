import { NextResponse } from "next/server";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sendPostPublishedNotification,
  sendPostFailedNotification,
  sendNewCommentNotification,
  sendAccountDisconnectedNotification,
} from "@/lib/notifications";

function verifySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Lease duration for a Zernio event claim. A PROCESSING row whose claimedAt
 * is older than this is considered abandoned (worker crash or timeout) and
 * may be reclaimed by another delivery.
 */
const ZERNIO_EVENT_LEASE_MS = 5 * 60 * 1000;

/**
 * Concurrency-safe, recoverable claim for a Zernio webhook event.
 *
 * Returns:
 *   - { status: "CLAIMED", claimToken } — this worker owns the event
 *   - { status: "SUCCEEDED" } — already processed, skip
 *   - { status: "BUSY" } — another worker is actively processing, skip
 *
 * The claim is atomic:
 *   1. Try to insert a new PROCESSING row. P2002 means a row exists.
 *   2. If a row exists and is SUCCEEDED, return SUCCEEDED.
 *   3. If a row exists and is FAILED or stale PROCESSING, conditionally
 *      updateMany to PROCESSING with a new claimToken. The conditional
 *      update ensures two concurrent workers cannot both reclaim the same row.
 */
async function claimZernioEvent(
  eventId: string,
  eventType: string
): Promise<
  | { status: "CLAIMED"; claimToken: string }
  | { status: "SUCCEEDED" }
  | { status: "BUSY" }
> {
  const now = new Date();
  const claimToken = randomUUID();

  try {
    await prisma.zernioEvent.create({
      data: {
        eventId,
        eventType,
        status: "PROCESSING",
        claimToken,
        claimedAt: now,
      },
    });
    return { status: "CLAIMED", claimToken };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  // Row exists — re-read and decide.
  const existing = await prisma.zernioEvent.findUnique({
    where: { eventId },
    select: { status: true },
  });
  if (existing?.status === "SUCCEEDED") return { status: "SUCCEEDED" };

  const staleBefore = new Date(now.getTime() - ZERNIO_EVENT_LEASE_MS);
  const reclaimed = await prisma.zernioEvent.updateMany({
    where: {
      eventId,
      OR: [
        { status: "FAILED" },
        { status: "PROCESSING", claimedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "PROCESSING",
      eventType,
      claimToken,
      claimedAt: now,
      attempts: { increment: 1 },
      lastError: null,
    },
  });

  return reclaimed.count === 1
    ? { status: "CLAIMED", claimToken }
    : { status: "BUSY" };
}

export async function POST(request: Request) {
  const webhookSecret = process.env.ZERNIO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[ZERNIO WEBHOOK] ZERNIO_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const signature = request.headers.get("x-zernio-signature") || request.headers.get("x-hub-signature-256");

  if (!verifySignature(body, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    type?: string;
    eventId?: string;
    id?: string;
    accountId?: string;
    profileId?: string;
    platform?: string;
    postId?: string;
    postUrl?: string;
    likes?: number;
    error?: string;
    commenter?: { name?: string; username?: string };
  };

  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type;
  if (!eventType) {
    return NextResponse.json({ error: "Missing event type" }, { status: 400 });
  }

  // ── Idempotency: deduplicate webhook deliveries ──────────────────────
  // Zernio may redeliver events on timeout/5xx. Use the provider's eventId/id
  // if present, otherwise derive a deterministic key from the event payload
  // so identical redeliveries map to the same row.
  const eventId = event.eventId ?? event.id ?? crypto
    .createHash("sha256")
    .update(body)
    .digest("hex")
    .slice(0, 64);

  // Concurrency-safe claim. Previously the findUnique + update/create pattern
  // allowed two workers to both process the same event (duplicate
  // notifications) and left crashed workers' rows stuck in PROCESSING.
  const claim = await claimZernioEvent(eventId, eventType);
  if (claim.status === "SUCCEEDED") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (claim.status === "BUSY") {
    // Another worker is actively processing — acknowledge to stop redelivery.
    return NextResponse.json({ ok: true, inProgress: true });
  }

  const { claimToken } = claim;

  // Find the user by Zernio account ID or profile ID
  let userId: string | null = null;
  if (event.accountId) {
    const account = await prisma.zernioAccount.findFirst({
      where: { zernioAccountId: event.accountId },
      select: { userId: true, platform: true },
    });
    if (account) {
      userId = account.userId;
      if (!event.platform) event.platform = account.platform;
    }
  }
  if (!userId && event.profileId) {
    const account = await prisma.zernioAccount.findFirst({
      where: { zernioProfileId: event.profileId },
      select: { userId: true, platform: true },
    });
    if (account) {
      userId = account.userId;
      if (!event.platform) event.platform = account.platform;
    }
  }

  if (!userId) {
    console.warn(`[ZERNIO WEBHOOK] No user found for event ${eventType}`, { accountId: event.accountId, profileId: event.profileId });
    // Mark as SUCCEEDED — no user to notify, no point retrying. Guarded by
    // claimToken so only the claim holder can finalize.
    await prisma.zernioEvent.updateMany({
      where: { eventId, claimToken, status: "PROCESSING" },
      data: { status: "SUCCEEDED", processedAt: new Date(), claimToken: null },
    }).catch((err) => console.error("[ZERNIO WEBHOOK] Failed to mark event SUCCEEDED:", err));
    return NextResponse.json({ ok: true, message: "No matching user" });
  }

  const platform = event.platform ?? "social";

  try {
    switch (eventType) {
      case "post.published":
      case "post.external.created": {
        await sendPostPublishedNotification(userId, platform, event.likes ?? 0);
        break;
      }
      case "post.failed": {
        await sendPostFailedNotification(userId, platform, event.error);
        break;
      }
      case "comment.received": {
        const commenterName = event.commenter?.name || event.commenter?.username;
        await sendNewCommentNotification(userId, platform, commenterName);
        break;
      }
      case "account.disconnected": {
        await sendAccountDisconnectedNotification(userId, platform);
        break;
      }
      default:
        console.log(`[ZERNIO WEBHOOK] Unhandled event type: ${eventType}`);
    }

    // Finalize as SUCCEEDED — guarded by claimToken so only the claim holder
    // can mark it. If the lease was lost (stale reclaim by another worker),
    // this update is a no-op and the other worker owns the finalization.
    const completed = await prisma.zernioEvent.updateMany({
      where: { eventId, claimToken, status: "PROCESSING" },
      data: { status: "SUCCEEDED", processedAt: new Date(), claimToken: null, lastError: null },
    });
    if (completed.count === 0) {
      console.warn(`[ZERNIO WEBHOOK] Lost processing lease for ${eventId}`);
    }
  } catch (err) {
    console.error(`[ZERNIO WEBHOOK] Failed to process ${eventType}:`, err);
    // Finalize as FAILED — guarded by claimToken.
    await prisma.zernioEvent.updateMany({
      where: { eventId, claimToken, status: "PROCESSING" },
      data: { status: "FAILED", claimToken: null, lastError: (err instanceof Error ? err.message : String(err)).slice(0, 2000) },
    }).catch((e) => console.error("[ZERNIO WEBHOOK] Failed to mark event FAILED:", e));
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Zernio webhook endpoint is active" });
}
