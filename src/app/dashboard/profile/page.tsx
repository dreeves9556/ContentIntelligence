import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileDashboardClient from "./ProfileDashboardClient";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session?.user?.id;

  const questionnaire = userId
    ? await prisma.questionnaire.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, content: true },
      })
    : null;

  return (
    <ProfileDashboardClient
      questionnaire={
        questionnaire
          ? { content: questionnaire.content as Record<string, unknown> }
          : null
      }
    />
  );
}
