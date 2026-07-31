import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getRevenueData } from "./actions";
import RevenueDashboardClient from "./RevenueDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Revenue",
};

export default async function AdminRevenuePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const data = await getRevenueData();

  if ("error" in data) {
    redirect("/dashboard");
  }

  return <RevenueDashboardClient data={data} />;
}
