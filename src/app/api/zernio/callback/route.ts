import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { zernio } from "@/lib/zernio";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const platform = searchParams.get("platform");
  const userId = searchParams.get("userId");
  const profileId = searchParams.get("profileId");

  if (!platform || !userId || !profileId) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=missing_params", req.nextUrl.origin)
    );
  }

  const session = await auth();
  if (!session?.user?.id || session.user.id !== userId) {
    return NextResponse.redirect(
      new URL("/login", req.nextUrl.origin)
    );
  }

  try {
    // List accounts under this profile to find the newly connected one
    const accounts = await zernio.accounts.list(profileId);
    const connected = accounts.find((a) => a.platform === platform);

    if (!connected) {
      return NextResponse.redirect(
        new URL(
          `/dashboard/integrations?error=account_not_found&platform=${platform}`,
          req.nextUrl.origin
        )
      );
    }

    // Upsert: one row per user per platform
    await prisma.zernioAccount.upsert({
      where: { userId_platform: { userId, platform } },
      update: {
        zernioProfileId: profileId,
        zernioAccountId: connected._id,
        handle: connected.handle ?? null,
      },
      create: {
        userId,
        zernioProfileId: profileId,
        zernioAccountId: connected._id,
        platform,
        handle: connected.handle ?? null,
      },
    });

    return NextResponse.redirect(
      new URL("/dashboard/integrations?connected=" + platform, req.nextUrl.origin)
    );
  } catch (error) {
    console.error("Zernio callback error:", error);
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=callback_failed", req.nextUrl.origin)
    );
  }
}
