"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildMemoriesFromSurvey } from "@/lib/memory/memory-builder";
import { validateQuestionnaire } from "@/lib/validation";
import { requireDashboardAccess } from "@/lib/server-access";

const VALID_SURVEY_TYPES = [
  "TRENCH_WARFARE",
  "ORIGIN_STORY",
  "CLIENT_AVATAR",
  "LOCAL_MAYOR",
  "WEEKLY_CONTEXT",
  "MONTHLY_CONTEXT",
  "STORY_REFRESH",
  "OFFER_FUNNEL",
  "PROOF_BANK",
  "COMPLIANCE_GUARDRAILS",
] as const;

function validateSurveyAnswers(answers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(answers)) {
    if (typeof key !== "string" || key.length > 100) return false;
    if (typeof value !== "string" || value.length > 5000) return false;
  }
  return Object.keys(answers).length <= 50;
}

export async function saveProfileSurvey(
  surveyType: string,
  answers: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };
  const userId = access.user.id;

  if (!VALID_SURVEY_TYPES.includes(surveyType as typeof VALID_SURVEY_TYPES[number])) {
    return { success: false, error: "Invalid survey type." };
  }

  if (!answers || typeof answers !== "object" || !validateSurveyAnswers(answers)) {
    return { success: false, error: "Invalid survey data." };
  }

  await prisma.profileSurvey.upsert({
    where: { userId_surveyType: { userId, surveyType } },
    update: { answersJson: answers as unknown as Prisma.InputJsonValue },
    create: {
      userId,
      surveyType,
      answersJson: answers as unknown as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/questionnaire");

  // Build/update memories from survey answers (background, non-blocking)
  buildMemoriesFromSurvey(userId, surveyType, answers).catch((err) =>
    console.error("Memory creation from survey failed:", err)
  );

  return { success: true };
}

export async function deleteProfileSurvey(
  surveyType: string
): Promise<{ success: boolean; error?: string }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };

  await prisma.profileSurvey.deleteMany({
    where: { userId: access.user.id, surveyType },
  });

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/questionnaire");
  return { success: true };
}

export async function updateOnboarding(
  answers: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const access = await requireDashboardAccess();
  if (!access.allowed) return { success: false, error: access.error };
  const userId = access.user.id;

  const validation = validateQuestionnaire(answers);
  if (!validation.success || !validation.data) {
    return { success: false, error: validation.error ?? "Invalid questionnaire data." };
  }

  const existing = await prisma.questionnaire.findFirst({
    where: { userId },
  });

  if (!existing) return { success: false, error: "No onboarding record found." };

  const validatedData = validation.data;

  await prisma.questionnaire.update({
    where: { id: existing.id },
    data: {
      content: validatedData as unknown as Prisma.InputJsonValue,
      ...(validatedData.name ? { title: `Brand Questionnaire — ${validatedData.name}` } : {}),
    },
  });

  if (validatedData.name) {
    await prisma.user.update({
      where: { id: userId },
      data: { name: validatedData.name },
    });
  }

  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/questionnaire");
  return { success: true };
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Not authenticated." };

  if (!currentPassword || !newPassword) {
    return { success: false, error: "All fields are required." };
  }

  if (newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return { success: false, error: "Password must include at least one letter and one number." };
  }

  if (currentPassword === newPassword) {
    return { success: false, error: "New password must be different from your current password." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  });

  if (!user || !user.password) {
    return { success: false, error: "Account not found." };
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return { success: false, error: "Current password is incorrect." };
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
    },
  });

  return { success: true };
}
