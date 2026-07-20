import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shouldBlockDashboardAccess, type AccountAccessUser } from "@/lib/account-access";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      accountStatus: true,
      accessExpiresAt: true,
      expirationAction: true,
      isComped: true,
      internalTag: true,
    },
  });

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
            Access Inactive
          </h1>
          <p className="text-sm text-text-muted leading-relaxed">
            Your access to The Local Post is currently inactive. If you believe this is a
            mistake, please contact our team.
          </p>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-accent-primary hover:bg-accent-primary/90 text-white font-medium rounded-lg transition-colors text-sm"
            >
              Sign Out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
