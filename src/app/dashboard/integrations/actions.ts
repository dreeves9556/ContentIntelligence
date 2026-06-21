"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function disconnectInstagram() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.account.deleteMany({
    where: { userId: session.user.id, provider: "facebook" },
  });

  revalidatePath("/dashboard/integrations");
  return { success: true };
}

export async function disconnectTikTok() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");

  await prisma.account.deleteMany({
    where: { userId: session.user.id, provider: "tiktok" },
  });

  revalidatePath("/dashboard/integrations");
  return { success: true };
}
