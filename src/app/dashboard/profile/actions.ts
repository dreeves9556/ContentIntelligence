"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export async function saveProfileSurvey(
  surveyType: string,
  answers: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  await prisma.profileSurvey.upsert({
    where: { userId_surveyType: { userId: session.user.id, surveyType } },
    update: { answersJson: answers as unknown as Prisma.InputJsonValue },
    create: {
      userId: session.user.id,
      surveyType,
      answersJson: answers as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function deleteProfileSurvey(
  surveyType: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  await prisma.profileSurvey.deleteMany({
    where: { userId: session.user.id, surveyType },
  });

  revalidatePath("/dashboard/profile");
  return { success: true };
}

export async function updateOnboarding(
  answers: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  const existing = await prisma.questionnaire.findFirst({
    where: { userId: session.user.id },
  });

  if (!existing) return { success: false, error: "No onboarding record found." };

  const name =
    typeof answers.name === "string" ? answers.name : undefined;

  await prisma.questionnaire.update({
    where: { id: existing.id },
    data: {
      content: answers as unknown as Prisma.InputJsonValue,
      ...(name ? { title: `Brand Questionnaire — ${name}` } : {}),
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/settings");
  return { success: true };
}
