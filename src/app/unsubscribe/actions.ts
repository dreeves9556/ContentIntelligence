"use server";

import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export async function unsubscribeUser(token: string): Promise<{ success: boolean; error?: string }> {
  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return { success: false, error: "Invalid unsubscribe link." };
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { email: true, emailUnsubscribed: true },
  });

  if (!user) {
    return { success: false, error: "Account not found." };
  }

  if (user.email?.toLowerCase() !== decoded.email.toLowerCase()) {
    return { success: false, error: "Invalid unsubscribe link." };
  }

  if (user.emailUnsubscribed) {
    return { success: true };
  }

  await prisma.user.update({
    where: { id: decoded.userId },
    data: { emailUnsubscribed: true },
  });

  return { success: true };
}
