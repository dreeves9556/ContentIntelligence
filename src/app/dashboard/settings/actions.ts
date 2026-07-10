"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { QuestionnaireFormData } from "@/lib/questionnaire-actions";
import { validateQuestionnaire } from "@/lib/validation";

export type UpdateQuestionnaireResult =
  | { success: true }
  | { success: false; error: string };

export async function updateQuestionnaire(
  questionnaireId: string,
  data: QuestionnaireFormData
): Promise<UpdateQuestionnaireResult> {
  const session = await auth();

  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated." };
  }

  const existing = await prisma.questionnaire.findUnique({
    where: { id: questionnaireId },
    select: { userId: true },
  });

  if (!existing) {
    return { success: false, error: "Questionnaire not found." };
  }

  if (existing.userId !== session.user.id) {
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
      where: { id: session.user.id },
      data: { name: validatedData.name },
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/questionnaire");

  return { success: true };
}
