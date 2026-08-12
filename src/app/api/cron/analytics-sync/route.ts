import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAnalyticsSyncPass } from "@/lib/analytics-sync-service";

function verifyCronAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
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

  try {
    const result = await runAnalyticsSyncPass();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[CRON ANALYTICS SYNC] Failed:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
