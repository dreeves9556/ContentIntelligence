import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { isStripeCheckoutConfigured } from "@/lib/stripe-config";
import { severZernioForUser } from "@/lib/zernio-sever";
import { decideAccountDelete, decideAfterStripeCancelFailure } from "@/lib/deletion-hardening";

/**
 * Permanently delete the user's account and all associated data.
 * - Cancels Stripe subscription immediately (if any)
 * - Deletes the User record, which cascades to all related data:
 *   questionnaires, calendars, socialTokens, socialProfiles, postAnalytics,
 *   contentArchives, contentFeedback, pushSubscriptions, profileSurveys,
 *   zernioAccounts, bestTimeToPosts, followerStats, deepAnalytics,
 *   creatorMemories, calendarGenerationLogs, notificationLogs,
 *   notificationPreference, accounts, sessions, resourcePosts, bugReports
 * - AdminMessage relations are SetNull (preserved but unlinked)
 * - Organization relation is SetNull (user just leaves the org)
 * - ScheduledPushNotifications created by this user are SetNull (preserved but unlinked)
 *
 * If the user is a TEAM_ADMIN, they must transfer admin role first.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body.password) {
    return NextResponse.json({ error: "Password confirmation is required to delete your account." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      password: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      organizationId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (!user.password) {
    return NextResponse.json({ error: "Password confirmation is required to delete your account." }, { status: 400 });
  }

  const passwordValid = await bcrypt.compare(body.password, user.password);

  // Delegate the hardening decision to the pure helper (unit-tested).
  const decision = decideAccountDelete({
    userId: user.id,
    role: user.role,
    hasPassword: !!user.password,
    passwordValid,
    stripeSubscriptionId: user.stripeSubscriptionId,
    stripeConfigured: isStripeCheckoutConfigured(),
  });
  if (decision.kind === "BLOCK") {
    return NextResponse.json({ error: decision.error }, { status: decision.status });
  }

  // Cancel Stripe subscription immediately if the user has one.
  // Only cancel the org subscription if the user is a TEAM_ADMIN.
  // Regular community members (USER role) just get their account deleted —
  // the org subscription stays active for remaining members.
  const subscriptionId = user.stripeSubscriptionId;

  // Regular community members: don't touch the org subscription.
  // TEAM_ADMIN users are blocked above, so only USER role reaches here.
  // Their stripeSubscriptionId is already captured above (if any).

  if (subscriptionId) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(subscriptionId);
      console.log(`[ACCOUNT DELETE] Cancelled Stripe subscription ${subscriptionId} for user ${user.id}`);
    } catch (error) {
      console.error("[ACCOUNT DELETE] Failed to cancel Stripe subscription:", error);
      const fail = decideAfterStripeCancelFailure("account");
      return NextResponse.json({ error: fail.error }, { status: fail.status });
    }
  }

  try {
    // Sever Zernio social-account connections on Zernio's side BEFORE the DB
    // cascade removes our records. Best-effort — errors are logged but don't
    // block (a failed Zernio delete is recoverable; an orphaned paid
    // subscription is not).
    await severZernioForUser(user.id);

    // Clean up any invite tokens associated with this user's email
    if (user.email) {
      await prisma.inviteToken.deleteMany({
        where: { email: user.email },
      });
    }

    // Delete the user — all Cascade relations are automatically deleted
    await prisma.user.delete({ where: { id: user.id } });

    console.log(`[ACCOUNT DELETE] User ${user.id} (${user.email}) permanently deleted`);

    return NextResponse.json({
      success: true,
      message: "Account and all associated data permanently deleted.",
    });
  } catch (error) {
    console.error("[ACCOUNT DELETE] Failed to delete user:", error);
    return NextResponse.json(
      { error: "Failed to delete account. Please contact support." },
      { status: 500 }
    );
  }
}
