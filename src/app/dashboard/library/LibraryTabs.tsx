"use client";

import { useState } from "react";
import { Archive, BookOpen } from "lucide-react";
import LibraryClient from "./LibraryClient";
import ResourcesTab from "./ResourcesTab";
import type { ResourcePostData } from "@/app/admin/resources/actions";

interface SavedCalendar {
  id: string;
  weekNumber: number;
  createdAt: string;
  days: import("@/app/dashboard/calendar/actions").CalendarDay[];
  weekStarting: string;
  postedDayIndices: boolean[];
}

const TABS = [
  { id: "archive", label: "My Posts", icon: Archive },
  { id: "resources", label: "Resources", icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LibraryTabs({
  calendars,
  resourcePosts,
}: {
  calendars: SavedCalendar[];
  resourcePosts: ResourcePostData[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("archive");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-background-secondary">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                isActive
                  ? "border-accent-primary text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "archive" ? (
        calendars.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4">
            <div className="p-4 bg-accent-primary/10 rounded-full mb-4">
              <Archive className="h-8 w-8 text-accent-primary" />
            </div>
            <h2
              className="text-xl font-bold text-text-primary mb-2"
              style={{ fontFamily: "var(--font-playfair)" }}
            >
              Your archive is empty
            </h2>
            <p className="text-text-muted max-w-sm text-sm">
              Posts you mark as scheduled or posted from your calendar will appear here.
            </p>
          </div>
        ) : (
          <LibraryClient calendars={calendars} />
        )
      ) : (
        <ResourcesTab posts={resourcePosts} />
      )}
    </div>
  );
}
