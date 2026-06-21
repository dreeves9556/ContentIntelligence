import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookOpen, Library } from "lucide-react";
import LibraryClient from "./LibraryClient";
import type { WeeklyCalendar } from "@/app/dashboard/calendar/actions";

export default async function LibraryPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [rawCalendars, archivedPosts] = await Promise.all([
    prisma.calendar.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contentArchive.findMany({
      where: { userId: session.user.id },
      select: { weekStarting: true, dayIndex: true },
    }),
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
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
            Content Library
          </h1>
          <p className="text-text-muted mt-1">
            Every calendar ever generated for you — organized by week
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-background-card rounded-lg border border-background-secondary self-start">
          <BookOpen className="h-4 w-4 text-accent-primary" />
          <span className="text-sm text-text-primary font-medium">
            {calendars.length} week{calendars.length !== 1 ? "s" : ""} generated
          </span>
        </div>
      </div>

      {/* Empty state */}
      {calendars.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
          <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
            <Library className="h-8 w-8 text-accent-primary" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
            Your library is empty
          </h2>
          <p className="text-text-muted max-w-sm">
            Once you generate your first content calendar, every week will be saved here automatically.
          </p>
        </div>
      )}

      {/* Calendar list */}
      {calendars.length > 0 && <LibraryClient calendars={calendars} />}
    </div>
  );
}
