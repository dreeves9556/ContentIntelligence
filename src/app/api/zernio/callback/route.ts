import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { zernio } from "@/lib/zernio";
import { revalidatePath } from "next/cache";
import { ensureBaselineForUserPlatform } from "@/lib/impact-baselines";
import { requireDashboardAccess } from "@/lib/server-access";
import { consumeIntegrationConnectionState } from "@/lib/integration-state";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const stateToken = searchParams.get("state");

  if (!stateToken) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=missing_params", req.nextUrl.origin)
    );
  }

  const access = await requireDashboardAccess({ requiredPlan: "PRO" });
  if (!access.allowed) {
    return NextResponse.redirect(
      new URL("/login", req.nextUrl.origin)
    );
  }
  const userId = access.user.id;

  const state = await consumeIntegrationConnectionState(stateToken, userId);
  if (!state) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=invalid_state", req.nextUrl.origin)
    );
  }
  const { platform, profileId } = state;

  const existingAccount = await prisma.zernioAccount.findFirst({
    where: { userId },
    select: { zernioProfileId: true },
  });
  if (existingAccount && existingAccount.zernioProfileId !== profileId) {
    return NextResponse.redirect(
      new URL("/dashboard/integrations?error=invalid_profile", req.nextUrl.origin)
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

    revalidatePath("/dashboard/calendar");

    ensureBaselineForUserPlatform(userId, platform).catch((err) => {
      console.error(`[impact] baseline creation failed for ${userId}/${platform}:`, err);
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
