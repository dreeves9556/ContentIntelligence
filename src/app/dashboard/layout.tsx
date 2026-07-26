import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { shouldBlockDashboardAccess, type AccountAccessUser } from "@/lib/account-access";
import { getAccessUser } from "@/lib/server-access";
import { prisma } from "@/lib/prisma";
import { getPendingLoginAnnouncements } from "@/app/admin/announcements/login-queries";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await getAccessUser(session.user.id);

  if (!user) redirect("/login");

  const accessUser: AccountAccessUser = {
    id: user.id,
    role: user.role,
    accountStatus: user.accountStatus,
    accessExpiresAt: user.accessExpiresAt,
    expirationAction: user.expirationAction,
    isComped: user.isComped,
    internalTag: user.internalTag,
  };

  if (shouldBlockDashboardAccess(accessUser)) {
    const isLocked = user.accountStatus === "ARCHIVED";
    const isTrialExpired = isLocked && user.hasUsedTrial && !user.stripeSubscriptionId;
    return (
      <div className="min-h-screen bg-background-secondary flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-background-card border border-border-primary rounded-xl p-8 text-center space-y-4">
          <div className="flex justify-center">
            <svg
              className="h-12 w-12 text-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h1
            className="text-xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isTrialExpired ? "Free Trial Ended" : isLocked ? "Access Paused" : "Access Inactive"}
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            {isTrialExpired
              ? "Your 7-day free trial has ended. Subscribe to a Solo membership to restore full access to The Local Post. Your data and content are still here."
              : isLocked
              ? "Your seat in this organization has been reduced. To continue using The Local Post, subscribe to your own membership."
              : "Your access to The Local Post is currently inactive. If you believe this is a mistake, please contact our team."}
          </p>
          {(isLocked || isTrialExpired) && (
            <a
              href="/dashboard/billing"
              className="block w-full py-2.5 px-4 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Subscribe to Continue
            </a>
          )}
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-background-secondary hover:bg-background-secondary/80 text-text-muted font-medium rounded-lg transition-colors text-sm border border-border-primary"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const hasConnectedAccounts = await prisma.zernioAccount
    .count({ where: { userId: user.id } })
    .then((c) => c > 0)
    .catch(() => false);

  const { announcements: loginAnnouncements } = await getPendingLoginAnnouncements(
    user.id,
    user.plan,
    hasConnectedAccounts
  );

  return (
    <DashboardLayoutClient loginAnnouncements={loginAnnouncements}>
      {children}
    </DashboardLayoutClient>
  );
}
