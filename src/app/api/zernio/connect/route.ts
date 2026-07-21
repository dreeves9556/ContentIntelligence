import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { zernio } from "@/lib/zernio";
import { getEnabledPlatforms } from "@/lib/platform-config";
import { requireDashboardAccess } from "@/lib/server-access";
import { createIntegrationConnectionState } from "@/lib/integration-state";

export async function GET(req: NextRequest) {
  const access = await requireDashboardAccess({ requiredPlan: "PRO" });
  if (!access.allowed) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const userId = access.user.id;

  const platform = req.nextUrl.searchParams.get("platform");
  if (!platform) {
    return NextResponse.json({ error: "Missing platform" }, { status: 400 });
  }

  const enabled = await getEnabledPlatforms();
  if (!enabled.includes(platform)) {
    return NextResponse.json(
      { error: `Platform "${platform}" is not enabled` },
      { status: 403 }
    );
  }

  try {
    // Get or create a Zernio profile for this user
    let zernioProfileId: string;

    const existingAccount = await prisma.zernioAccount.findFirst({
      where: { userId },
      select: { zernioProfileId: true },
    });

    if (existingAccount) {
      zernioProfileId = existingAccount.zernioProfileId;
    } else {
      // Create a new Zernio profile named after the user
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      const profileName = dbUser?.name ?? dbUser?.email ?? userId;
      const profile = await zernio.profiles.create(profileName);
      zernioProfileId = profile._id;
    }

    const state = await createIntegrationConnectionState({
      userId,
      platform,
      profileId: zernioProfileId,
    });
    const callbackUrl = new URL(
      "/api/zernio/callback",
      process.env.NEXTAUTH_URL ?? req.nextUrl.origin
    );
    callbackUrl.searchParams.set("state", state);

    const { authUrl } = await zernio.connect.getConnectUrl(
      platform,
      zernioProfileId,
      callbackUrl.toString()
    );

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Zernio connect error:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
