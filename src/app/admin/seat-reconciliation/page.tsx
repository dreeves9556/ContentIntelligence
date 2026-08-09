import { redirect } from "next/navigation";
import { auth } from "@/auth";
import SeatReconciliationAdminClient from "./SeatReconciliationAdminClient";
import { listRecoveryOps } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seat Reconciliation — Admin",
};

export default async function AdminSeatReconciliationPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { rows, hasMore, error } = await listRecoveryOps();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-text-muted">{error}</p>
      </div>
    );
  }

  return <SeatReconciliationAdminClient initialRows={rows ?? []} hasMore={hasMore ?? false} />;
}
