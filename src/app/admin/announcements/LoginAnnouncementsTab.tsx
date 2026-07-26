"use client";

import { useState } from "react";
import { Mail, MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnnouncementsClient } from "./AnnouncementsClient";
import { LoginAnnouncementsManager } from "./LoginAnnouncementsManager";
import type { ScheduledBroadcastData } from "./actions";
import type { LoginAnnouncementData } from "./login-actions";

export function LoginAnnouncementsTab({
  broadcasts,
  loginAnnouncements,
}: {
  broadcasts: ScheduledBroadcastData[];
  loginAnnouncements: LoginAnnouncementData[];
}) {
  const [tab, setTab] = useState<"email" | "login">("email");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border-primary">
        <button
          onClick={() => setTab("email")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "email"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          )}
        >
          <Mail className="h-4 w-4" />
          Email Broadcasts
        </button>
        <button
          onClick={() => setTab("login")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "login"
              ? "border-accent-primary text-accent-primary"
              : "border-transparent text-text-muted hover:text-text-primary"
          )}
        >
          <MonitorSmartphone className="h-4 w-4" />
          Login Messages
        </button>
      </div>

      {tab === "email" ? (
        <AnnouncementsClient initialBroadcasts={broadcasts} />
      ) : (
        <LoginAnnouncementsManager initialAnnouncements={loginAnnouncements} />
      )}
    </div>
  );
}
