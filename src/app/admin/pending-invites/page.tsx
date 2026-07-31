import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPendingStripeInvites } from "./actions";
import PendingInvitesClient from "./PendingInvitesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pending Stripe Invites",
};

export default async function AdminPendingInvitesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const invites = await getPendingStripeInvites();

  return <PendingInvitesClient initialInvites={invites} />;
}
