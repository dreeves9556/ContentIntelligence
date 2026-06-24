import { getWeeklyCalendar } from "./actions";
import { GenerateButton } from "./GenerateButton";
import CalendarClient from "./CalendarClient";
import CalendarStrategyNote from "./CalendarStrategyNote";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Sparkles,
  Video,
  Images,
  FileText,
  Calendar,
} from "lucide-react";

export default async function CalendarPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const calendar = await getWeeklyCalendar();

  // Empty state - no calendar generated yet
  if (!calendar) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
          <Sparkles className="h-8 w-8 text-accent-primary" />
        </div>
        <h2 className="text-xl font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-playfair)" }}>
          Generate Your First Content Calendar
        </h2>
        <p className="text-text-muted max-w-md mb-8">
          Our AI will analyze your questionnaire responses and create a personalized content calendar tailored to your brand and goals.
        </p>
        <GenerateButton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-playfair)" }}>
            Content Calendar
          </h1>
          <p className="text-text-muted mt-1">
            Your AI-powered weekly content strategy
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-background-card rounded-lg border border-background-secondary">
            <Calendar className="h-4 w-4 text-accent-primary" />
            <span className="text-sm text-text-primary font-medium">
              Week of {new Date(calendar.weekStarting).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
          </div>
          <GenerateButton regenerate />
        </div>
      </div>

      {/* AI Strategy Note */}
      <CalendarStrategyNote />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-sm text-text-muted font-medium">Content Types:</span>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-text-muted">Reel</span>
          </div>
          <div className="flex items-center gap-2">
            <Images className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-text-muted">Carousel</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-green-400" />
            <span className="text-xs text-text-muted">Static</span>
          </div>
        </div>
        <div className="w-px h-4 bg-background-secondary hidden sm:block" />
        <span className="text-sm text-text-muted font-medium">Buckets:</span>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded bg-brand-personal/20 border border-brand-personal" />
            <span className="text-xs text-text-muted">Personal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded bg-brand-expert/20 border border-brand-expert" />
            <span className="text-xs text-text-muted">Expert</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded bg-brand-local/20 border border-brand-local" />
            <span className="text-xs text-text-muted">Local</span>
          </div>
        </div>
      </div>

      {/* Focus Mode Calendar */}
      <CalendarClient days={calendar.days} weekStarting={calendar.weekStarting} />
    </div>
  );
}
