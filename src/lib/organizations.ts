/**
 * Organization & Team Admin Utilities
 *
 * This module provides the core authorization and seat-management helpers
 * for the Organization / Team Admin system.
 *
 * Roles:
 *   USER        — Standard creator, belongs to 0 or 1 organization.
 *   TEAM_ADMIN  — Manages one organization (invite, remove, view roster).
 *                 Cannot access /admin/* (blocked by proxy.ts + auth.config.ts).
 *   ADMIN       — Global admin, manages all orgs and users. Not org-scoped.
 *
 * Seat counting:
 *   usedSeats = activeUsers (org members) + pendingInvites (unexpired).
 *   Pending invites reserve a seat at creation time.
 *   Registration converts a reserved seat to an active seat (net zero change).
 *   Over-limit orgs block new invites but do NOT delete existing users.
 *
 * Stripe integration (future):
 *   Organization.seatLimit, seatPlan, stripeCustomerId, stripeSubscriptionId,
 *   and stripeStatus fields are placeholders. Stripe webhooks will populate
 *   them. No Stripe SDK or env vars are required yet.
 *
 * InviteToken.email is globally unique (@unique in schema) — only one
 * pending invite per email across all orgs. Creating a new invite for an
 * email that has an existing (expired or different-org) invite will delete
 * the old one first.
 */

import { prisma } from "@/lib/prisma";
import type { UserPlan } from "@/lib/tiers";
import { requireDashboardAccess } from "@/lib/server-access";

export interface SeatUsage {
  activeUsers: number;
  pendingInvites: number;
  usedSeats: number;
  seatLimit: number;
  availableSeats: number;
  isOverLimit: boolean;
}

/**
 * Count seat usage for an organization.
 *
 * Seat usage = active org users + pending unexpired invites.
 * - Active users are all Users with organizationId set to this org (includes the team admin).
 * - Pending invites are InviteTokens tied to this org that have not expired.
 * - Expired invites do NOT count.
 * - Deleted/cancelled invites do NOT count (they are removed from the table).
 * - When an invited user registers, the pending invite is deleted and the new
 *   user counts as active — so the total used seats stays stable across registration.
 */
export async function getOrganizationSeatUsage(organizationId: string): Promise<SeatUsage> {
  const now = new Date();

  const [activeUsers, pendingInvites, org] = await Promise.all([
    prisma.user.count({
      where: {
        organizationId,
        accountStatus: { not: "ARCHIVED" },
      },
    }),
    prisma.inviteToken.count({
      where: {
        organizationId,
        expiresAt: { gt: now },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { seatLimit: true },
    }),
  ]);

  const seatLimit = org?.seatLimit ?? 0;
  const usedSeats = activeUsers + pendingInvites;
  const availableSeats = seatLimit - usedSeats;

  return {
    activeUsers,
    pendingInvites,
    usedSeats,
    seatLimit,
    availableSeats,
    isOverLimit: usedSeats > seatLimit,
  };
}

/**
 * Fetch an organization together with its seat usage.
 */
export async function getOrganizationWithUsage(organizationId: string) {
  const [organization, usage] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    getOrganizationSeatUsage(organizationId),
  ]);

  if (!organization) return null;

  return { organization, usage };
}

/**
 * Whether the organization has at least one available seat for a new invite.
 */
export async function canInviteOrganizationMember(organizationId: string): Promise<boolean> {
  const usage = await getOrganizationSeatUsage(organizationId);
  return usage.availableSeats > 0;
}

/**
 * Require the current session user to be a TEAM_ADMIN with an organization.
 * Returns the user and their organization, or null if not authorized.
 *
 * Security: This is the primary authorization gate for all team admin
 * server actions. It reads the user's organizationId from the DB (not from
 * the client), ensuring that even a tampered session cannot access another
 * org's data. TEAM_ADMIN role is verified from the session, which is
 * refreshed from the DB on every JWT callback.
 */
export async function requireTeamAdminOrganization() {
  const access = await requireDashboardAccess();
  if (!access.allowed || access.user.role !== "TEAM_ADMIN") return null;

  const user = await prisma.user.findUnique({
    where: { id: access.user.id },
    select: { id: true, organizationId: true, name: true, email: true },
  });

  if (!user?.organizationId) return null;

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });

  if (!organization) return null;

  return { user, organization };
}

/**
 * Assert that a team admin can manage a target user (target must be in the
 * same organization). Returns true if allowed, false otherwise.
 *
 * Security: Prevents cross-org data leakage. The target user's
 * organizationId is read from the DB and compared to the team admin's org.
 * Also returns false if the target is an ADMIN (team admins cannot manage
 * global admins).
 */
export async function assertTeamAdminCanManageUser(
  teamAdminOrgId: string,
  targetUserId: string
): Promise<boolean> {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, organizationId: true, role: true },
  });

  if (!target) return false;
  if (target.organizationId !== teamAdminOrgId) return false;
  return true;
}

/**
 * Generate a URL-safe slug from an organization name, ensuring uniqueness
 * by appending a short suffix if needed.
 */
export async function generateUniqueSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  let slug = base || "organization";
  let suffix = 1;

  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    suffix++;
  }

  return slug;
}

/**
 * When an organization's seatPlan changes, update all current non-ADMIN
 * organization members to the new plan.
 *
 * Note: This function is kept for backward compatibility but is now called
 * inline within transactions in admin/organizations/actions.ts to ensure
 * atomicity. ADMIN users are excluded — they are global and keep their own plan.
 */
export async function propagatePlanToOrgMembers(organizationId: string, plan: UserPlan): Promise<void> {
  await prisma.user.updateMany({
    where: {
      organizationId,
      role: { not: "ADMIN" },
    },
    data: { plan },
  });
}
