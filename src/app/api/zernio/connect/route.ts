import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { zernio } from "@/lib/zernio";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platform = req.nextUrl.searchParams.get("platform");
  if (!platform) {
    return NextResponse.json({ error: "Missing platform" }, { status: 400 });
  }

  try {
    // Get or create a Zernio profile for this user
    let zernioProfileId: string;

    const existingAccount = await prisma.zernioAccount.findFirst({
      where: { userId: session.user.id },
      select: { zernioProfileId: true },
    });

    if (existingAccount) {
      zernioProfileId = existingAccount.zernioProfileId;
    } else {
      // Create a new Zernio profile named after the user
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      });
      const profileName = dbUser?.name ?? dbUser?.email ?? session.user.id;
      const profile = await zernio.profiles.create(profileName);
      zernioProfileId = profile._id;
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/zernio/callback?platform=${platform}&userId=${session.user.id}&profileId=${zernioProfileId}`;

    const { authUrl } = await zernio.connect.getConnectUrl(
      platform,
      zernioProfileId,
      callbackUrl
    );

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Zernio connect error:", error);
    return NextResponse.json({ error: "Failed to initiate connection" }, { status: 500 });
  }
}
