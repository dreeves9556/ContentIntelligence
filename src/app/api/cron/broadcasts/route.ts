import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { processDueBroadcasts } from "@/app/admin/announcements/actions";

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

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cronSecret = process.env.CRON_SECRET!;

  try {
    const result = await processDueBroadcasts(cronSecret);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[CRON BROADCASTS] Failed:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
