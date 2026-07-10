"use client";

import { useSession, signOut } from "next-auth/react";
import {
  Mail,
  MapPin,
  LogOut,
  Building2,
} from "lucide-react";
import ChangePasswordForm from "./ChangePasswordForm";
import { PushNotificationManager } from "@/components/PushNotificationManager";
import { NotificationHistory } from "@/components/NotificationHistory";
import { NotificationSettings } from "@/components/NotificationSettings";

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuestionnaireData {
  name?: string;
  businessName?: string;
  city?: string;
  [key: string]: unknown;
}

interface Props {
  questionnaire: { content: QuestionnaireData } | null;
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function ProfileDashboardClient({ questionnaire }: Props) {
  const { data: session } = useSession();

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : session?.user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="max-w-2xl mx-auto lg:max-w-none lg:mx-0 space-y-4 sm:space-y-6">
      {/* ── Personal Info Header ── */}
      <div className="rounded-2xl border border-border-primary bg-background-card p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-5">
          {/* Avatar */}
          {session?.user?.image ? (
            <img src={session.user.image} alt="avatar" className="h-14 w-14 rounded-full object-cover border-2 border-accent-primary shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-accent-primary/20 flex items-center justify-center text-lg font-bold text-accent-primary border-2 border-accent-primary shrink-0">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate" style={{ fontFamily: "var(--font-serif)" }}>
              {session?.user?.name ?? "Your Profile"}
            </h1>
            <p className="text-sm text-text-muted">{session?.user?.email}</p>
          </div>
        </div>

        {/* Info pills */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 text-sm text-text-muted mb-5">
          {session?.user?.email && (
            <span className="flex items-center gap-1.5 min-w-0">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{session.user.email}</span>
            </span>
          )}
          {questionnaire?.content?.city && (
            <span className="flex items-center gap-1.5 min-w-0">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="truncate">{questionnaire.content.city}</span>
            </span>
          )}
          {questionnaire?.content?.businessName && (
            <span className="flex items-center gap-1.5 min-w-0">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{questionnaire.content.businessName}</span>
            </span>
          )}
        </div>

        {/* Change password */}
        <div className="mt-5 pt-5 border-t border-border-primary">
          <ChangePasswordForm />
        </div>

        {/* Sign out */}
        <div className="mt-5 pt-5 border-t border-border-primary">
          <button
            onClick={() => signOut({ redirect: false }).then(() => { window.location.href = "/login"; })}
            className="flex items-center gap-2 text-sm text-red-400/70 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* ── Push Notifications ── */}
      <PushNotificationManager />

      {/* ── Notification Settings ── */}
      <NotificationSettings />

      {/* ── Notification History ── */}
      <NotificationHistory />
    </div>
  );
}
