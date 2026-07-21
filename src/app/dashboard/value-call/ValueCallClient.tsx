"use client";

import { useState, useEffect } from "react";

interface ValueCallSettingsProps {
  title: string;
  description: string | null;
  callStartsAt: string | null;
  zoomUrl: string | null;
  timezone: string | null;
  isEnabled: boolean;
}

interface DisplayProps {
  dateLabel: string;
  timeLabel: string;
  timezoneLabel: string;
}

interface Props {
  settings: ValueCallSettingsProps;
  display: DisplayProps | null;
}

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

type CallState = "no-call" | "upcoming" | "live" | "ended";

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function getCountdown(target: number): Countdown {
  const now = Date.now();
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

export default function ValueCallClient({ settings, display }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    const timeout = setTimeout(updateNow, 0);
    const interval = setInterval(updateNow, 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  if (!settings.isEnabled || !settings.callStartsAt) {
    return <NoCallScheduled />;
  }

  const startMs = new Date(settings.callStartsAt).getTime();

  if (now === null) {
    return <NoCallScheduled />;
  }

  let state: CallState;
  if (now < startMs) {
    state = "upcoming";
  } else if (now < startMs + LIVE_WINDOW_MS) {
    state = "live";
  } else {
    state = "ended";
  }

  if (state === "ended") {
    return <CallEnded />;
  }

  if (state === "live") {
    return <CallLive zoomUrl={settings.zoomUrl} title={settings.title} description={settings.description} display={display} />;
  }

  return (
    <CallUpcoming
      title={settings.title}
      description={settings.description}
      display={display}
      countdown={getCountdown(startMs)}
    />
  );
}

function NoCallScheduled() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Value Call
        </h1>
        <p className="text-text-muted mt-1">
          Join the next member value call with The Local Post.
        </p>
      </div>

      <div className="bg-background-card border border-border-primary rounded-xl p-5 sm:p-8">
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-background-secondary">
              <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
          </div>
          <h2
            className="text-xl font-bold text-text-primary mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            No Value Call is scheduled yet.
          </h2>
          <p className="text-sm text-text-muted leading-relaxed max-w-md mx-auto">
            Check back soon. The next member call will appear here once it has been scheduled.
          </p>
        </div>
      </div>

      <div className="bg-gradient-to-r from-accent-primary/10 via-accent-primary/5 to-transparent border border-accent-primary/20 rounded-xl p-6">
        <p className="text-sm text-text-primary leading-relaxed">
          This is a biweekly group call for members to get direction, sharpen content ideas,
          talk through what is working, and stay consistent with their local brand.
        </p>
      </div>
    </div>
  );
}

function CallUpcoming({
  title,
  description,
  display,
  countdown,
}: {
  title: string;
  description: string | null;
  display: DisplayProps | null;
  countdown: Countdown;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Value Call
        </h1>
        <p className="text-text-muted mt-1">
          Join the next member value call with The Local Post.
        </p>
      </div>

      <div className="bg-background-card border border-border-primary rounded-xl p-5 sm:p-8 space-y-6">
        {/* Title & description */}
        <div>
          <h2
            className="text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-text-muted mt-2 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Date/time info */}
        {display && (
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>{display.dateLabel}</span>
            <span>·</span>
            <span>{display.timeLabel}</span>
            <span>·</span>
            <span>{display.timezoneLabel}</span>
          </div>
        )}

        {/* Countdown */}
        <div className="bg-background-secondary rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted mb-4">Your next Value Call starts in:</p>
          <div className="flex justify-center gap-4 sm:gap-8">
            <CountdownUnit value={countdown.days} label="days" />
            <CountdownUnit value={countdown.hours} label="hours" />
            <CountdownUnit value={countdown.minutes} label="min" />
            <CountdownUnit value={countdown.seconds} label="sec" />
          </div>
        </div>

        {/* Locked Zoom button */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-background-secondary border border-border-primary text-text-muted text-sm cursor-not-allowed select-none">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
            Zoom link unlocks when the call starts
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-accent-primary/10 via-accent-primary/5 to-transparent border border-accent-primary/20 rounded-xl p-6">
        <p className="text-sm text-text-primary leading-relaxed">
          This is a biweekly group call for members to get direction, sharpen content ideas,
          talk through what is working, and stay consistent with their local brand.
        </p>
      </div>
    </div>
  );
}

function CallLive({
  zoomUrl,
  title,
  description,
  display,
}: {
  zoomUrl: string | null;
  title: string;
  description: string | null;
  display: DisplayProps | null;
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Value Call
        </h1>
        <p className="text-text-muted mt-1">
          Join the next member value call with The Local Post.
        </p>
      </div>

      <div className="bg-background-card border border-accent-primary/30 rounded-xl p-5 sm:p-8 space-y-6">
        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
          <span className="text-sm font-semibold text-red-500 uppercase tracking-wider">Live Now</span>
        </div>

        {/* Title & description */}
        <div>
          <h2
            className="text-2xl font-bold text-text-primary"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {title}
          </h2>
          {description && (
            <p className="text-text-muted mt-2 leading-relaxed">{description}</p>
          )}
        </div>

        {/* Date/time info */}
        {display && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            <span>{display.dateLabel}</span>
            <span>·</span>
            <span>{display.timeLabel}</span>
            <span>·</span>
            <span>{display.timezoneLabel}</span>
          </div>
        )}

        {/* Join button */}
        <div className="space-y-3">
          <p className="text-sm text-text-primary text-center">
            The call is live. Use the button below to join.
          </p>
          {zoomUrl ? (
            <a
              href={zoomUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 px-6 rounded-xl bg-accent-primary text-white font-bold text-center text-sm hover:bg-accent-primary/90 transition-colors"
            >
              Join Value Call
            </a>
          ) : (
            <p className="text-sm text-text-muted text-center">
              The Zoom link has not been configured. Please contact support.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CallEnded() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Value Call
        </h1>
        <p className="text-text-muted mt-1">
          Join the next member value call with The Local Post.
        </p>
      </div>

      <div className="bg-background-card border border-border-primary rounded-xl p-5 sm:p-8">
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-background-secondary">
              <svg className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2
            className="text-xl font-bold text-text-primary mb-2"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            This Value Call has ended.
          </h2>
          <p className="text-sm text-text-muted leading-relaxed max-w-md mx-auto">
            The next call will appear here once it has been scheduled.
          </p>
        </div>
      </div>
    </div>
  );
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-accent-primary tabular-nums">
        {String(value).padStart(2, "0")}
      </div>
      <div className="text-xs text-text-muted mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}
