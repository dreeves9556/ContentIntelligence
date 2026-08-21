import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { checkActionRateLimit, formatRetryTime } from "@/lib/rate-limiter";
import {
  sendCommunityInquiry,
  validateCommunityInquiry,
} from "@/lib/community-inquiry";

export async function POST(request: Request) {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientIp = forwardedFor || requestHeaders.get("x-real-ip") || "unknown";
  const rateLimit = await checkActionRateLimit(
    `community_inquiry:${clientIp}`,
    5,
    10 * 60 * 1000
  );

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Too many inquiries. Please try again in ${formatRetryTime(rateLimit.retryAfterMs ?? 0)}.`,
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const validation = validateCommunityInquiry(body);
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const sent = await sendCommunityInquiry(validation.data);
  if (!sent) {
    return NextResponse.json(
      { error: "We could not send your inquiry. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
