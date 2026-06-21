"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function registerWithToken(
  token: string,
  password: string
): Promise<{ error: string } | never> {
  if (!token || !password) {
    return { error: "Missing required fields." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token } });

  if (!invite) {
    return { error: "This invitation link is invalid or has already been used." };
  }

  if (invite.expiresAt < new Date()) {
    return { error: "This invitation link has expired." };
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email: invite.email,
      password: hashedPassword,
      role: "USER",
    },
  });

  await prisma.inviteToken.delete({ where: { token } });

  redirect("/onboarding");
}
