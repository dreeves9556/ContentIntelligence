import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { zernio } from "@/lib/zernio";

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
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      role: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      organizationId: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // TEAM_ADMIN must transfer admin role before deleting their account
  if (user.role === "TEAM_ADMIN") {
    return NextResponse.json(
      {
        error:
          "You are the team admin for your organization. Please transfer your admin role to another member before deleting your account.",
      },
      { status: 400 }
    );
  }

  // Global admins cannot self-delete
  if (user.role === "ADMIN") {
    return NextResponse.json(
      { error: "Admin accounts cannot be self-deleted." },
      { status: 400 }
    );
  }

  // Cancel Stripe subscription immediately if the user has one.
  // Only cancel the org subscription if the user is a TEAM_ADMIN.
  // Regular community members (USER role) just get their account deleted —
  // the org subscription stays active for remaining members.
  const subscriptionId = user.stripeSubscriptionId;

  // Regular community members: don't touch the org subscription.
  // TEAM_ADMIN users are blocked above, so only USER role reaches here.
  // Their stripeSubscriptionId is already captured above (if any).

  const stripe = getStripe();

  if (subscriptionId) {
    try {
      await stripe.subscriptions.cancel(subscriptionId);
      console.log(`[ACCOUNT DELETE] Cancelled Stripe subscription ${subscriptionId} for user ${user.id}`);
    } catch (error) {
      // Log but don't block — the subscription may already be canceled
      console.error("[ACCOUNT DELETE] Failed to cancel Stripe subscription:", error);
    }
  }

  try {
    // Delete Zernio accounts on Zernio's side before DB cascade removes our records
    const zernioAccounts = await prisma.zernioAccount.findMany({
      where: { userId: user.id },
      select: { zernioAccountId: true, platform: true },
    });

    for (const acc of zernioAccounts) {
      try {
        await zernio.accounts.delete(acc.zernioAccountId);
        console.log(`[ACCOUNT DELETE] Deleted Zernio account ${acc.zernioAccountId} (${acc.platform})`);
      } catch (error) {
        console.error(`[ACCOUNT DELETE] Failed to delete Zernio account ${acc.zernioAccountId}:`, error);
      }
    }

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
