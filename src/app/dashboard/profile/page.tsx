import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileDashboardClient from "./ProfileDashboardClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const [questionnaire, profileSurveys] = await Promise.all([
    userId
      ? prisma.questionnaire.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
          select: { id: true, content: true },
        })
      : null,
    userId
      ? prisma.profileSurvey.findMany({
          where: { userId },
          select: { id: true, surveyType: true, answersJson: true, updatedAt: true },
        })
      : [],
  ]);

  return (
    <ProfileDashboardClient
      questionnaire={
        questionnaire
          ? { id: questionnaire.id, content: questionnaire.content as Record<string, unknown> }
          : null
      }
      profileSurveys={profileSurveys.map((s: { id: string; surveyType: string; answersJson: unknown; updatedAt: Date }) => ({
        id: s.id,
        surveyType: s.surveyType,
        answersJson: s.answersJson as Record<string, string>,
        updatedAt: s.updatedAt.toISOString(),
      }))}
    />
  );
}
