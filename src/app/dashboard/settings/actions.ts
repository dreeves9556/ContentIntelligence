"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import { validateQuestionnaire } from "@/lib/validation";
import { requireDashboardAccess } from "@/lib/server-access";

export type UpdateQuestionnaireResult =
  | { success: true }
  | { success: false; error: string };

export async function updateQuestionnaire(
  questionnaireId: string,
  data: QuestionnaireFormData
): Promise<UpdateQuestionnaireResult> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };
  const userId = access.user.id;

  const existing = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { userId: true },
  });

  if (!existing) {
    return { success: false, error: "Questionnaire not found." };
  }

  if (existing.userId !== userId) {
    return { success: false, error: "Not authorised to edit this questionnaire." };
  }

  const validation = validateQuestionnaire(data);
  if (!validation.success || !validation.data) {
    return { success: false, error: validation.error ?? "Invalid questionnaire data." };
  }

  const validatedData = validation.data;

  await prisma.questionnaire.update({
    where: { id: questionnaireId },
    data: {
      content: validatedData as object,
      title: `Brand Questionnaire — ${validatedData.name || "Unnamed"}`,
    },
  });

  if (validatedData.name) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: validatedData.name },
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/questionnaire");

  return { success: true };
}
