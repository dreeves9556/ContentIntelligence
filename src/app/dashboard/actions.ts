"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import webpush from "web-push";

webpush.setVapidDetails(
  process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:hello@contentintelligence.co",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushPayload {
  title: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  requireInteraction?: boolean;
}

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

export async function subscribeUser(sub: PushSubscription) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const serializedSub = JSON.parse(JSON.stringify(sub)) as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  await prisma.pushSubscription.upsert({
    where: { endpoint: serializedSub.endpoint },
    update: {
      userId: session.user.id,
      p256dh: serializedSub.keys.p256dh,
      auth: serializedSub.keys.auth,
    },
    create: {
      userId: session.user.id,
      endpoint: serializedSub.endpoint,
      p256dh: serializedSub.keys.p256dh,
      auth: serializedSub.keys.auth,
    },
  });

  return { success: true };
}

export async function unsubscribeUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id },
  });

  return { success: true };
}

export async function getPushSubscriptionStatus() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const count = await prisma.pushSubscription.count({
    where: { userId: session.user.id },
  });

  return { subscribed: count > 0, count };
}

export async function sendNotification(message: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: session.user.id },
  });

  if (subscriptions.length === 0) {
    throw new Error("No push subscriptions found");
  }

  const payload: PushPayload = {
    title: "Test Notification",
    body: message,
    icon: "/icon.svg",
    url: "/dashboard",
  };

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length === results.length) {
    throw new Error("Failed to send all push notifications");
  }

  return { success: true, sent: results.length - failed.length };
}

export async function sendNotificationToUser(userId: string, payload: PushPayload) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  if (session.user.role !== "ADMIN") throw new Error("Not authorized");

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return { success: false, error: "No push subscriptions found" };
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return { success: true, sent, failed };
}
