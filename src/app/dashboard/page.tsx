import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const posts = await prisma.postAnalytics.findMany({
    where: { userId: session.user.id },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      format: true,
      publishedAt: true,
      views: true,
      likes: true,
      comments: true,
    },
  });

  // Serialize dates to ISO strings for the client component
  const serializedPosts = posts.map((p) => ({
    ...p,
    publishedAt: p.publishedAt.toISOString(),
  }));

  return <AnalyticsClient posts={serializedPosts} />;
}
