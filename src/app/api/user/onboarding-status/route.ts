import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ onboardingComplete: false }, { status: 401 });
  }

  const questionnaire = await prisma.questionnaire.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });

  return NextResponse.json({ onboardingComplete: !!questionnaire });
}
