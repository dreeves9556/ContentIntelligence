"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Only USER and TEAM_ADMIN are valid roles for invite-based registration.
// ADMIN must never be assignable via invite token — it is a global admin role
// that can only be granted directly by an existing ADMIN via the admin panel.
const ALLOWED_INVITE_ROLES = ["USER", "TEAM_ADMIN"] as const;

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

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: "Password must include at least one letter and one number." };
  }

  const invite = await prisma.inviteToken.findUnique({ where: { token } });

  if (!invite) {
    return { error: "This invitation link is invalid or has already been used." };
  }

  if (invite.expiresAt < new Date()) {
    return { error: "This invitation link has expired." };
  }

  // Block ADMIN role from invite-based registration — prevents privilege
  // escalation even if a token is tampered with or misconfigured.
  const assignedRole = invite.inviteRole ?? "USER";
  if (!ALLOWED_INVITE_ROLES.includes(assignedRole as typeof ALLOWED_INVITE_ROLES[number])) {
    return { error: "This invitation link is invalid." };
  }

  // If the invite references an organization, verify it still exists.
  // A deleted org would leave the user in a broken state.
  if (invite.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: { id: true },
    });
    if (!org) {
      return { error: "This invitation link is no longer valid — the organization no longer exists." };
    }
  }

  const existingUser = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  // Wrap user creation + token deletion in a transaction so that a failure
  // in either operation doesn't leave inconsistent state (e.g. user created
  // but token not deleted, allowing reuse).
  //
  // Seat counting note: A pending invite reserves a seat at creation time.
  // Registration converts the reserved seat to an active user seat. The invite
  // token is deleted, keeping total used seats stable across registration.
  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        password: hashedPassword,
        role: assignedRole,
        plan: invite.plan ?? "CALENDAR_ONLY",
        organizationId: invite.organizationId ?? null,
      },
    }),
    prisma.inviteToken.delete({ where: { token } }),
  ]);

  redirect("/onboarding");
}
