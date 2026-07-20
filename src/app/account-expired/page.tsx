import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Access Expired — The Local Post",
};

export default async function AccountExpiredPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

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
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1
          className="text-xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Access Expired
        </h1>
        <p className="text-sm text-text-muted leading-relaxed">
          Your access to The Local Post has expired. To reactivate your account, please
          contact our team.
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
