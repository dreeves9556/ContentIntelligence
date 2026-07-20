import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganizations, type AdminOrgData } from "./actions";
import OrganizationsAdminClient from "./OrganizationsAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Organizations — Admin",
};

export default async function AdminOrganizationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const { data, error } = await getOrganizations();

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-text-muted">{error}</p>
      </div>
    );
  }

  return <OrganizationsAdminClient initialOrgs={data ?? []} />;
}
