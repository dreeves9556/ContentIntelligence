"use client";

import { Lock } from "lucide-react";
import { PLAN_LABELS, type UserPlan } from "@/lib/tiers";

interface LockedTabOverlayProps {
  requiredPlan: UserPlan;
  currentPlan: UserPlan;
  featureName: string;
  featureDescription: string;
  children: React.ReactNode;
}

export default function LockedTabOverlay({
  requiredPlan,
  featureName,
  featureDescription,
  children,
}: LockedTabOverlayProps) {
  return (
    <div className="relative">
      {/* Blurred preview of real content */}
      <div className="pointer-events-none select-none" style={{ filter: "blur(6px)", opacity: 0.6 }}>
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-background-secondary border border-background-primary rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-accent-primary/10 border border-accent-primary/20">
              <Lock className="h-8 w-8 text-accent-primary" />
            </div>
          </div>
          <h2
            className="text-xl font-bold text-text-primary mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {featureName} Locked
          </h2>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            {featureDescription}
          </p>
          <div className="mb-4 px-3 py-1.5 bg-accent-primary/10 rounded-full inline-block">
            <span className="text-xs font-semibold text-accent-primary uppercase tracking-wider">
              Available on {PLAN_LABELS[requiredPlan]}
            </span>
          </div>
          <button
            onClick={() => {
              /* TODO: wire to subscription upgrade flow */
            }}
            className="w-full py-3 px-6 rounded-xl text-sm font-bold transition-all hover:opacity-90 bg-accent-primary text-white hover:bg-accent-primary/90"
          >
            Upgrade Your Plan
          </button>
        </div>
      </div>
    </div>
  );
}
