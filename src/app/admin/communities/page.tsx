import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrganizations } from "../organizations/actions";
import CommunitiesAdminClient from "./CommunitiesAdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Communities — Admin",
};

export default async function AdminCommunitiesPage() {
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

  return <CommunitiesAdminClient initialOrgs={data ?? []} />;
}
