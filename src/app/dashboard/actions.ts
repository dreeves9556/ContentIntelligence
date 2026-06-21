"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const SEED_POSTS = [
  {
    title: "How to Build Your Personal Brand in 2025",
    format: "REEL",
    publishedAt: new Date("2025-06-15"),
    views: 12500,
    likes: 980,
    comments: 145,
  },
  {
    title: "5 Tips for Local Business Marketing",
    format: "CAROUSEL",
    publishedAt: new Date("2025-06-12"),
    views: 8900,
    likes: 620,
    comments: 87,
  },
  {
    title: "Behind the Scenes: Our Creative Process",
    format: "REEL",
    publishedAt: new Date("2025-06-10"),
    views: 15200,
    likes: 1450,
    comments: 203,
  },
  {
    title: "Expert Advice: Industry Trends to Watch",
    format: "STATIC",
    publishedAt: new Date("2025-06-08"),
    views: 6700,
    likes: 410,
    comments: 62,
  },
  {
    title: "Customer Success Story: Local Cafe Rebrand",
    format: "CAROUSEL",
    publishedAt: new Date("2025-06-05"),
    views: 9800,
    likes: 870,
    comments: 134,
  },
  {
    title: "Product Launch: What's New This Month",
    format: "REEL",
    publishedAt: new Date("2025-06-03"),
    views: 18300,
    likes: 1720,
    comments: 298,
  },
  {
    title: "Community Spotlight: Local Artists",
    format: "STATIC",
    publishedAt: new Date("2025-06-01"),
    views: 5400,
    likes: 380,
    comments: 51,
  },
];

export async function seedPostAnalytics() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  // Check if user already has seed data
  const existing = await prisma.postAnalytics.count({
    where: { userId: session.user.id },
  });

  if (existing > 0) {
    return { success: true, message: `Already have ${existing} posts`, count: existing };
  }

  await prisma.postAnalytics.createMany({
    data: SEED_POSTS.map((post) => ({
      ...post,
      userId: session.user!.id!,
      externalId: `ig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    })),
  });

  revalidatePath("/dashboard");
  return { success: true, message: "Seeded 7 dummy posts", count: 7 };
}
