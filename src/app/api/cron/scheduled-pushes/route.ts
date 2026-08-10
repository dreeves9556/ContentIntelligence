import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runScheduledPushPass } from "@/lib/scheduled-push-service";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Dedicated cron route for scheduled admin push notifications.
 *
 * Runs every 5 minutes (see vercel.json) so scheduled pushes are delivered
 * promptly instead of waiting up to 24 hours for the daily notifications cron.
 *
 * The route delegates to the bounded, recoverable claim service
 * (src/lib/scheduled-push-service.ts), which:
 *  - claims no more than the batch size,
 *  - processes only rows the current worker claimed,
 *  - reclaims stale PROCESSING rows after a lease timeout,
 *  - preserves terminal states and records failures.
 *
 * Posting reminders, streak warnings, and the weekly digest remain on the
 * daily /api/cron/notifications route so a 5-minute scheduled-push cron does
 * not send reminders at midnight UTC.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduledPushPass();
    return NextResponse.json({ ok: true, scheduledPushes: result });
  } catch (err) {
    console.error("[CRON SCHEDULED-PUSHES] Failed:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
