"use client";

import { useState, useTransition } from "react";
import { updateValueCallSettings, type ValueCallSettingsOutput } from "./actions";
import { formatValueCallDisplayDate } from "@/lib/value-call";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HST)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
];

interface Props {
  settings: ValueCallSettingsOutput;
}

export default function ValueCallAdminClient({ settings }: Props) {
  const [isEnabled, setIsEnabled] = useState(settings.isEnabled);
  const [title, setTitle] = useState(settings.title);
  const [description, setDescription] = useState(settings.description ?? "");
  const [zoomUrl, setZoomUrl] = useState(settings.zoomUrl ?? "");
  const [timezone, setTimezone] = useState(settings.timezone ?? "America/New_York");
  const [callDate, setCallDate] = useState("");
  const [callTime, setCallTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Parse existing callStartsAt into date/time fields for the form
  useState(() => {
    if (settings.callStartsAt) {
      const d = new Date(settings.callStartsAt);
      const tz = settings.timezone || "America/New_York";
      const datePart = d.toLocaleDateString("en-CA", { timeZone: tz });
      const timePart = d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
      setCallDate(datePart);
      setCallTime(timePart);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await updateValueCallSettings({
        title,
        description,
        callDate,
        callTime,
        timezone,
        zoomUrl,
        isEnabled,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error ?? "Failed to save settings.");
      }
    });
  };

  // Build preview from current form state
  const previewSettings = {
    callStartsAt: callDate && callTime ? new Date(`${callDate}T${callTime}:00`) : null,
    timezone,
    title,
    description,
    zoomUrl,
    isEnabled,
  };
  const previewDisplay = formatValueCallDisplayDate(previewSettings);

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Value Call
        </h1>
        <p className="text-text-muted mt-1">
          Set the next subscriber Value Call time and Zoom link. Members will see a countdown until the scheduled start time. The Zoom button appears when the call begins.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-background-card border border-border-primary rounded-xl p-6 space-y-5">
            {/* Enabled toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-semibold text-text-primary">Enabled</label>
                <p className="text-xs text-text-muted mt-0.5">Show the Value Call tab to members</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnabled(!isEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isEnabled ? "bg-accent-primary" : "bg-border-primary"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-semibold text-text-primary mb-1.5">
                Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Next Value Call"
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-text-primary mb-1.5">
                Description <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Bring questions, wins, and content ideas to the next group call."
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40 resize-none"
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="callDate" className="block text-sm font-semibold text-text-primary mb-1.5">
                  Date
                </label>
                <input
                  id="callDate"
                  type="date"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
                />
              </div>
              <div>
                <label htmlFor="callTime" className="block text-sm font-semibold text-text-primary mb-1.5">
                  Time
                </label>
                <input
                  id="callTime"
                  type="time"
                  value={callTime}
                  onChange={(e) => setCallTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
                />
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm font-semibold text-text-primary mb-1.5">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Zoom URL */}
            <div>
              <label htmlFor="zoomUrl" className="block text-sm font-semibold text-text-primary mb-1.5">
                Zoom Meeting URL
              </label>
              <input
                id="zoomUrl"
                type="url"
                value={zoomUrl}
                onChange={(e) => setZoomUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full px-3 py-2 rounded-lg bg-background-secondary border border-border-primary text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
              />
              <p className="text-xs text-text-muted mt-1">Must start with https://</p>
            </div>

            {/* Error / Success */}
            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-600 dark:text-green-400">
                Settings saved successfully.
              </div>
            )}

            {/* Save button */}
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 px-4 rounded-lg bg-accent-primary text-white font-semibold text-sm hover:bg-accent-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>

        {/* Preview */}
        <div className="space-y-4">
          <h2
            className="text-xl font-semibold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Member Preview
          </h2>
          <div className="bg-background-card border border-border-primary rounded-xl p-6">
            {!isEnabled ? (
              <div className="text-center py-8">
                <p className="text-text-muted text-sm">
                  Value Call is currently disabled. Members will not see this tab.
                </p>
              </div>
            ) : !previewDisplay ? (
              <div className="text-center py-8">
                <p className="text-text-muted text-sm">
                  No Value Call is scheduled yet.
                </p>
                <p className="text-text-muted text-xs mt-2">
                  Check back soon. The next member call will appear here once it has been scheduled.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3
                    className="text-lg font-bold text-text-primary"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    {title || "Next Value Call"}
                  </h3>
                  {description && (
                    <p className="text-sm text-text-muted mt-1">{description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>{previewDisplay.dateLabel}</span>
                  <span>·</span>
                  <span>{previewDisplay.timeLabel}</span>
                  <span>·</span>
                  <span>{previewDisplay.timezoneLabel}</span>
                </div>
                <div className="bg-background-secondary rounded-lg p-4 text-center">
                  <p className="text-xs text-text-muted mb-2">Your next Value Call starts in:</p>
                  <div className="flex justify-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent-primary">--</div>
                      <div className="text-xs text-text-muted">days</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent-primary">--</div>
                      <div className="text-xs text-text-muted">hours</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent-primary">--</div>
                      <div className="text-xs text-text-muted">min</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-accent-primary">--</div>
                      <div className="text-xs text-text-muted">sec</div>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-background-secondary border border-border-primary text-text-muted text-sm cursor-not-allowed">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    Zoom link unlocks when the call starts
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
