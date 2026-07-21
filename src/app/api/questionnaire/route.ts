import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateQuestionnaire } from "@/lib/validation";
import { buildMemoriesFromQuestionnaire } from "@/lib/memory/memory-builder";
import { requireDashboardAccess } from "@/lib/server-access";

export async function POST(req: NextRequest) {
  const access = await requireDashboardAccess();
  if (!access.allowed) {
    return NextResponse.json(
      { success: false, error: access.error },
      { status: access.status }
    );
  }

  try {
    const raw = await req.json();

    const validation = validateQuestionnaire(raw);
    if (!validation.success || !validation.data) {
      return NextResponse.json({ success: false, error: validation.error ?? "Invalid data" }, { status: 400 });
    }

    const data = validation.data;
    const userId = access.user.id;

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

    if (data.name) {
      await prisma.user.update({
        where: { id: userId },
        data: { name: data.name },
      });
    }

    // Build initial AI memories from questionnaire answers (background, non-blocking)
    buildMemoriesFromQuestionnaire(userId, data as never).catch((err) =>
      console.error("Memory creation from questionnaire failed:", err)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Questionnaire save error:", err);
    return NextResponse.json({ success: false, error: "Failed to save" }, { status: 500 });
  }
}
