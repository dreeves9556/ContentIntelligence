import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getOrCreateValueCallSettings, formatValueCallDisplayDate } from "@/lib/value-call";
import ValueCallClient from "./ValueCallClient";
import LockedTabOverlay from "@/components/LockedTabOverlay";
import { canAccessValueCall } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export default async function ValueCallPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const plan = (session.user.plan ?? "CALENDAR_ONLY") as UserPlan;

  const settings = await getOrCreateValueCallSettings();
  const display = formatValueCallDisplayDate(settings);

  const serializedSettings = {
    title: settings.title,
    description: settings.description,
    callStartsAt: settings.callStartsAt?.toISOString() ?? null,
    zoomUrl: settings.zoomUrl,
    timezone: settings.timezone,
    isEnabled: settings.isEnabled,
  };

  const serializedDisplay = display
    ? { dateLabel: display.dateLabel, timeLabel: display.timeLabel, timezoneLabel: display.timezoneLabel }
    : null;

  const content = (
    <ValueCallClient settings={serializedSettings} display={serializedDisplay} />
  );

  if (!canAccessValueCall(plan)) {
    return (
      <LockedTabOverlay
        requiredPlan="PRO"
        currentPlan={plan}
        featureName="Value Call"
        featureDescription="Get Full Access to join the biweekly member Value Call — a group call for direction, content ideas, and staying consistent with your local brand."
      >
        {content}
      </LockedTabOverlay>
    );
  }

  return content;
}
