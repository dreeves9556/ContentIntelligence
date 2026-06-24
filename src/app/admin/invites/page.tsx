import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPendingInvites } from "../actions";
import InvitesClient from "./InvitesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bulk Invites",
};

export default async function AdminInvitesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const invites = await getPendingInvites();

  return <InvitesClient initialInvites={invites} />;
}
