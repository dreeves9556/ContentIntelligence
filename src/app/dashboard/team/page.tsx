import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getTeamRoster, type TeamRosterData } from "./actions";
import TeamRosterClient from "./TeamRosterClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team Roster",
};

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  if (session.user.role !== "TEAM_ADMIN") {
    redirect("/dashboard");
  }

  // Double-check the user actually has an organizationId
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    redirect("/dashboard");
  }

  const { data, error } = await getTeamRoster();

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-text-muted">{error ?? "Unable to load team roster."}</p>
      </div>
    );
  }

  return <TeamRosterClient initialData={data} />;
}
