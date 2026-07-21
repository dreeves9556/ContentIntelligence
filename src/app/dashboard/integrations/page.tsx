import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Plug, Share2, Music2, Users, PlayCircle, Zap } from "lucide-react";
import ZernioCard from "./ZernioCard";
import FacebookInfoAccordion from "./FacebookInfoAccordion";
import { getEnabledPlatforms } from "@/lib/platform-config";
import LockedTabOverlay from "@/components/LockedTabOverlay";
import { canAccessIntegrations } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";

const ALL_PLATFORMS = [
  {
    platform: "instagram",
    label: "Instagram",
    description: "Sync feed, Reels, and Story analytics",
    iconBg: "bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500",
    icon: <Share2 className="h-6 w-6 text-white" />,
  },
  {
    platform: "tiktok",
    label: "TikTok",
    description: "Sync video performance & audience analytics",
    iconBg: "bg-gradient-to-br from-black to-neutral-800 border border-neutral-700",
    icon: <Music2 className="h-6 w-6 text-white" />,
  },
  {
    platform: "facebook",
    label: "Facebook",
    description: "Sync page posts, reach & engagement",
    iconBg: "bg-blue-600",
    icon: <Users className="h-6 w-6 text-white" />,
  },
  {
    platform: "youtube",
    label: "YouTube",
    description: "Sync video views, likes & comments",
    iconBg: "bg-red-600",
    icon: <PlayCircle className="h-6 w-6 text-white" />,
  },
];

export default async function IntegrationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const plan = (session.user.plan ?? "CALENDAR_ONLY") as UserPlan;

  const zernioAccounts = await prisma.zernioAccount.findMany({
    where: { userId: session.user.id },
  });

  const enabledPlatforms = await getEnabledPlatforms();
  const PLATFORMS = ALL_PLATFORMS.filter((p) =>
    enabledPlatforms.includes(p.platform)
  );

  const connectedMap: Record<string, { handle: string | null }> = Object.fromEntries(
    zernioAccounts.map((a: { platform: string; handle: string | null }) => [a.platform, a])
  );

  const connectedCount = zernioAccounts.length;

  const mainContent = (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Integrations
          </h1>
          <p className="text-text-muted mt-1">
            Connect your social accounts to pull real analytics data
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-gradient-to-r from-accent-primary/20 via-accent-primary/10 to-transparent border border-accent-primary/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-accent-primary/20 rounded-lg shrink-0">
            <Zap className="h-6 w-6 text-accent-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-accent-primary mb-2">
              Power Up Your Analytics
            </h3>
            <p className="text-text-primary leading-relaxed">
              Connect your social media accounts to automatically sync post performance data.
              Once connected, your Analytics dashboard will display real metrics from your content.
            </p>
          </div>
        </div>
      </div>

      {/* Integrations grid */}
      <div>
        <h2
          className="text-xl font-semibold text-text-primary mb-4"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Available Integrations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => (
            <ZernioCard
              key={p.platform}
              platform={p.platform}
              label={p.label}
              description={p.description}
              iconBg={p.iconBg}
              icon={p.icon}
              connected={!!connectedMap[p.platform]}
              handle={connectedMap[p.platform]?.handle}
              plan={plan}
              connectedCount={connectedCount}
            />
          ))}
          <div className="bg-background-card rounded-xl border border-dashed border-border-primary p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="p-3 bg-background-secondary rounded-xl mb-3">
              <Plug className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-muted">More platforms coming soon</p>
            <p className="text-xs text-text-muted mt-1">LinkedIn, Pinterest, Threads, and more</p>
          </div>
        </div>
      </div>

      {/* Facebook personal profile FAQ */}
      <FacebookInfoAccordion />
    </div>
  );

  if (!canAccessIntegrations(plan)) {
    return (
      <LockedTabOverlay
        requiredPlan="PRO"
        currentPlan={plan}
        featureName="Integrations"
        featureDescription="Get Full Access to connect your social media accounts and automatically sync performance data to your analytics dashboard."
      >
        {mainContent}
      </LockedTabOverlay>
    );
  }

  return mainContent;
}
