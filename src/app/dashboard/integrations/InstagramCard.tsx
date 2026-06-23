"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { CheckCircle, Loader2, Share2, Unplug } from "lucide-react";
import { disconnectZernioAccount } from "./actions";

interface InstagramCardProps {
  connected: boolean;
}

export default function InstagramCard({ connected: initialConnected }: InstagramCardProps) {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(initialConnected);

  const handleConnect = async () => {
    setLoading(true);
    await signIn("facebook", { callbackUrl: "/dashboard/integrations" });
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const result = await disconnectZernioAccount("instagram");
      if (result.success) {
        setIsConnected(false);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-card rounded-xl border border-background-secondary p-6 hover:border-accent-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 rounded-xl">
            <Share2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-lg">
              Meta — Facebook &amp; Instagram
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              One connection gives access to both Facebook Page and Instagram analytics
            </p>
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
              <div className="h-10 w-10 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 rounded-full flex items-center justify-center">
                <Share2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Facebook &amp; Instagram linked</p>
                <p className="text-xs text-text-muted">Ready to sync Facebook &amp; Instagram analytics</p>
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
              <Share2 className="h-4 w-4" />
            )}
            Connect Meta (Facebook &amp; Instagram)
          </button>
        )}
      </div>
    </div>
  );
}
