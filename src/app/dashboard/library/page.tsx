import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookOpen } from "lucide-react";
import LibraryTabs from "./LibraryTabs";
import { getPublishedResourcePosts } from "@/app/admin/resources/actions";
import type { WeeklyCalendar } from "@/app/dashboard/calendar/actions";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [rawCalendars, archivedPosts, resourcePosts] = await Promise.all([
    prisma.calendar.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentArchive.findMany({
      where: { userId: session.user.id },
      select: { weekStarting: true, dayIndex: true },
    }),
    getPublishedResourcePosts(),
  ]);

  const postedKeys = new Set(archivedPosts.map((a) => `${a.weekStarting}:${a.dayIndex}`));

  const calendars = rawCalendars.map((cal) => {
    const content = cal.contentJson as unknown as WeeklyCalendar;
    const weekStarting = content.weekStarting ?? cal.createdAt.toISOString().split("T")[0];
    return {
      id: cal.id,
      weekNumber: cal.weekNumber,
      createdAt: cal.createdAt.toISOString(),
      days: content.days ?? [],
      weekStarting,
      postedDayIndices: (content.days ?? []).map((_, i) => postedKeys.has(`${weekStarting}:${i}`)),
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-serif)" }}>
            Content Library
          </h1>
          <p className="text-text-muted mt-1">
            Your post archive and coaching resources — all in one place
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-background-card rounded-lg border border-border-primary self-start">
          <BookOpen className="h-4 w-4 text-accent-primary" />
          <span className="text-sm text-text-primary font-medium">
            {calendars.length} week{calendars.length !== 1 ? "s" : ""} · {resourcePosts.length} article{resourcePosts.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <LibraryTabs calendars={calendars} resourcePosts={resourcePosts} />
    </div>
  );
}
