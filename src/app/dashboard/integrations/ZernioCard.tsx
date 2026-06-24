"use client";

import { useState } from "react";
import { CheckCircle, Loader2, Unplug, Lock, ArrowUpRight } from "lucide-react";
import { disconnectZernioAccount } from "./actions";
import { CREATOR_ACCOUNT_LIMIT, hasUnlimitedAccounts } from "@/lib/tiers";
import type { UserPlan } from "@/lib/tiers";

interface ZernioCardProps {
  platform: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  connected: boolean;
  handle?: string | null;
  plan: UserPlan;
  connectedCount: number;
}

export default function ZernioCard({
  platform,
  label,
  description,
  icon,
  iconBg,
  connected: initialConnected,
  handle,
  plan,
  connectedCount,
}: ZernioCardProps) {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(initialConnected);
  const [connectedHandle, setConnectedHandle] = useState(handle);

  const isAtCreatorLimit =
    !hasUnlimitedAccounts(plan) &&
    !isConnected &&
    connectedCount >= CREATOR_ACCOUNT_LIMIT;

  const handleConnect = () => {
    setLoading(true);
    window.location.href = `/api/zernio/connect?platform=${platform}`;
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const result = await disconnectZernioAccount(platform);
      if (result.success) {
        setIsConnected(false);
        setConnectedHandle(null);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-card rounded-xl border border-background-secondary p-6 hover:border-accent-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
          <div>
            <h3 className="font-semibold text-text-primary text-lg">{label}</h3>
            <p className="text-sm text-text-muted mt-0.5">{description}</p>
          </div>
        </div>

        {isConnected && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full shrink-0">
            <CheckCircle className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-medium text-green-400">Connected</span>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-background-secondary">
        {isConnected ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${iconBg}`}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {connectedHandle ? `@${connectedHandle}` : `${label} linked`}
                </p>
                <p className="text-xs text-text-muted">Syncing analytics via Zernio</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 bg-red-400/10 hover:bg-red-400/20 border border-red-400/20 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unplug className="h-4 w-4" />
              )}
              Disconnect
            </button>
          </div>
        ) : isAtCreatorLimit ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background-secondary border border-background-primary">
              <Lock className="h-4 w-4 text-text-muted shrink-0" />
              <p className="text-xs text-text-muted leading-snug">
                You&apos;ve reached the {CREATOR_ACCOUNT_LIMIT}-account limit on the Creator plan.
                Upgrade to Pro for unlimited connections.
              </p>
            </div>
            <button
              onClick={() => {
                /* TODO: wire to subscription upgrade flow */
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 border border-accent-primary/40 text-accent-primary bg-accent-primary/10"
            >
              <ArrowUpRight className="h-4 w-4" />
              Upgrade to Pro
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "#c8952a", color: "#0a0a0a" }}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              icon
            )}
            Connect {label}
          </button>
        )}
      </div>
    </div>
  );
}
