import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Bug } from "lucide-react";
import { getBugReports } from "@/app/dashboard/bug-report/actions";
import BugsAdminClient from "./BugsAdminClient";

export const dynamic = "force-dynamic";

export default async function AdminBugsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") redirect("/dashboard");

  const reports = await getBugReports();

  const openCount = reports.filter((r) => r.status === "OPEN").length;
  const investigatedCount = reports.filter((r) => r.status === "INVESTIGATED").length;
  const solvedCount = reports.filter((r) => r.status === "SOLVED").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Bug Reports
          </h1>
          <p className="text-text-muted mt-1">
            Review user-submitted bug reports and update their status
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-background-card rounded-lg border border-border-primary self-start">
          <Bug className="h-4 w-4 text-accent-primary" />
          <span className="text-sm text-text-primary font-medium">{reports.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Open</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{openCount}</p>
        </div>
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Investigated</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{investigatedCount}</p>
        </div>
        <div className="bg-background-card rounded-lg border border-border-primary p-4">
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold">Solved</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{solvedCount}</p>
        </div>
      </div>

      <BugsAdminClient initialReports={reports} />
    </div>
  );
}
