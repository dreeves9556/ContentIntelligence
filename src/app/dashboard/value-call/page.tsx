import { redirect } from "next/navigation";
import { getOrCreateValueCallSettings, formatValueCallDisplayDate } from "@/lib/value-call";
import ValueCallClient from "./ValueCallClient";
import LockedTabOverlay from "@/components/LockedTabOverlay";
import { canAccessValueCall } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";
import { requireDashboardAccess } from "@/lib/server-access";

export const dynamic = "force-dynamic";

export default async function ValueCallPage() {
  const access = await requireDashboardAccess();
  if (!access.allowed) redirect(access.status === 401 ? "/login" : "/account-expired");

  const plan = access.user.plan as UserPlan;

  if (!canAccessValueCall(plan) && access.user.role !== "ADMIN") {
    return (
      <LockedTabOverlay
        requiredPlan="PRO"
        currentPlan={plan}
        featureName="Value Call"
        featureDescription="Get Full Access to join the biweekly member Value Call — a group call for direction, content ideas, and staying consistent with your local brand."
      >
        <ValueCallClient
          settings={{
            title: "Next Value Call",
            description: null,
            callStartsAt: null,
            zoomUrl: null,
            timezone: "America/New_York",
            isEnabled: false,
          }}
          display={null}
        />
      </LockedTabOverlay>
    );
  }

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

  return content;
}
