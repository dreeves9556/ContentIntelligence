"use client";

import { useState } from "react";
import { disconnectZernioAccount } from "./actions";
import { Camera, CheckCircle, Loader2, Unplug } from "lucide-react";

interface IntegrationCardProps {
  connected: boolean;
  handle: string | null;
}

export default function IntegrationCard({ connected, handle }: IntegrationCardProps) {
  const [loading, setLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(connected);
  const [currentHandle, setCurrentHandle] = useState(handle);

  const handleConnect = async () => {
    // Connect is handled via OAuth in InstagramCard — this legacy component is no longer active
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const result = await disconnectZernioAccount("instagram");
      if (result.success) {
        setIsConnected(false);
        setCurrentHandle(null);
      }
    } catch {
      // Handle error silently for now
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-card rounded-xl border border-background-secondary p-6 hover:border-accent-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl">
            <Camera className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary text-lg">
              Instagram Professional Account
            </h3>
            <p className="text-sm text-text-muted mt-0.5">
              Connect your Instagram to pull post analytics and insights
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
              <div className="h-10 w-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {currentHandle?.replace("@", "").charAt(0).toUpperCase() || "?"}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{currentHandle}</p>
                <p className="text-xs text-text-muted">Professional Account</p>
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
              <Camera className="h-4 w-4" />
            )}
            Connect Instagram
          </button>
        )}
      </div>
    </div>
  );
}
