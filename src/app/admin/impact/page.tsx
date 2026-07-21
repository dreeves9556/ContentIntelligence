import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getImpactData } from "./actions";
import ImpactDashboardClient from "./ImpactDashboardClient";

export const dynamic = "force-dynamic";

export default async function ImpactDashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session?.user?.role !== "ADMIN") redirect("/dashboard");

  const data = await getImpactData();

  if ("error" in data) {
    redirect("/dashboard");
  }

  return <ImpactDashboardClient data={data} />;
}
