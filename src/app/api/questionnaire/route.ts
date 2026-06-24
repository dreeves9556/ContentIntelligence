import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { validateQuestionnaire } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const raw = await req.json();

    const validation = validateQuestionnaire(raw);
    if (!validation.success || !validation.data) {
      return NextResponse.json({ success: false, error: validation.error ?? "Invalid data" }, { status: 400 });
    }

    const data = validation.data;
    const userId = session.user.id;

    const title = `Brand Questionnaire — ${data.businessName || data.name || "New Client"}`;
    const existing = await prisma.questionnaire.findFirst({ where: { userId } });

    if (existing) {
      await prisma.questionnaire.update({
        where: { id: existing.id },
        data: { title, content: data },
      });
    } else {
      await prisma.questionnaire.create({
        data: { title, content: data, userId },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Questionnaire save error:", err);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}
