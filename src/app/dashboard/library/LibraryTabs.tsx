"use client";

import { useState } from "react";
import { Archive, BookOpen, GraduationCap } from "lucide-react";
import LibraryClient from "./LibraryClient";
import ResourcesTab from "./ResourcesTab";
import Social101Tab from "./Social101Tab";
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
  { id: "resources", label: "Resources", icon: BookOpen },
  { id: "social101", label: "Social 101", icon: GraduationCap },
  { id: "archive", label: "My Posts", icon: Archive },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function LibraryTabs({
  calendars,
  resourcePosts,
}: {
  calendars: SavedCalendar[];
  resourcePosts: ResourcePostData[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("resources");

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-background-secondary bg-background-primary overflow-x-auto scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap shrink-0 ${
                isActive
                  ? "border-accent-primary text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "resources" ? (
        <ResourcesTab posts={resourcePosts} />
      ) : activeTab === "social101" ? (
        <Social101Tab />
      ) : calendars.length === 0 ? (
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
      )}
    </div>
  );
}
