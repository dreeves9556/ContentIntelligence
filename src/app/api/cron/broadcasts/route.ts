import { NextResponse } from "next/server";
import { processDueBroadcasts } from "@/app/admin/announcements/actions";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await processDueBroadcasts();
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[CRON BROADCASTS] Failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
