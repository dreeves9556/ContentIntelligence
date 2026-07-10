import { NextResponse } from "next/server";
import crypto from "crypto";
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
  } catch (err) {
    console.error(`[ZERNIO WEBHOOK] Failed to process ${eventType}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Zernio webhook endpoint is active" });
}
