import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Music2, Plug, Zap } from "lucide-react";
import InstagramCard from "./InstagramCard";
import TikTokCard from "./TikTokCard";

export default async function IntegrationsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const facebookAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "facebook" },
  });

  const tiktokAccount = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "tiktok" },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Integrations
        </h1>
        <p className="text-text-muted mt-1">
          Connect your social accounts to pull real analytics data
        </p>
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
          style={{ fontFamily: "var(--font-playfair)" }}
        >
          Available Integrations
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InstagramCard connected={!!facebookAccount} />
          <TikTokCard connected={!!tiktokAccount} />
          {/* More integrations */}
          <div className="bg-background-card rounded-xl border border-dashed border-background-secondary p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="p-3 bg-background-secondary rounded-xl mb-3">
              <Plug className="h-6 w-6 text-text-muted" />
            </div>
            <p className="text-sm font-medium text-text-muted">More integrations coming soon</p>
            <p className="text-xs text-text-muted mt-1">YouTube, LinkedIn, and more</p>
          </div>
        </div>
      </div>
    </div>
  );
}
