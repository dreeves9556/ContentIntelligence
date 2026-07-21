import { prisma } from "@/lib/prisma";
import type { ValueCallSettings } from "@prisma/client";

const LIVE_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

export type ValueCallSettingsData = ValueCallSettings;

export async function getValueCallSettings(): Promise<ValueCallSettings | null> {
  return prisma.valueCallSettings.findUnique({
    where: { id: "default" },
  });
}

export async function getOrCreateValueCallSettings(): Promise<ValueCallSettings> {
  return prisma.valueCallSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });
}

export function formatValueCallDisplayDate(settings: {
  callStartsAt: Date | null;
  timezone: string | null;
}): { dateLabel: string; timeLabel: string; timezoneLabel: string } | null {
  if (!settings.callStartsAt) return null;

  const tz = settings.timezone || "America/New_York";
  const dateOpts: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: tz,
  };
  const timeOpts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  };

  const dateLabel = new Intl.DateTimeFormat("en-US", dateOpts).format(settings.callStartsAt);
  const timeLabel = new Intl.DateTimeFormat("en-US", timeOpts).format(settings.callStartsAt);

  const timezoneLabel = tz === "America/New_York" ? "Eastern Time" : tz;

  return { dateLabel, timeLabel, timezoneLabel };
}

export function isValueCallLive(settings: {
  callStartsAt: Date | null;
  isEnabled: boolean;
}): boolean {
  if (!settings.callStartsAt || !settings.isEnabled) return false;
  const now = Date.now();
  const start = settings.callStartsAt.getTime();
  return now >= start && now < start + LIVE_WINDOW_MS;
}

export function hasValueCallEnded(settings: {
  callStartsAt: Date | null;
  isEnabled: boolean;
}): boolean {
  if (!settings.callStartsAt || !settings.isEnabled) return false;
  const now = Date.now();
  const start = settings.callStartsAt.getTime();
  return now >= start + LIVE_WINDOW_MS;
}

export function isValueCallScheduled(settings: {
  callStartsAt: Date | null;
  isEnabled: boolean;
}): boolean {
  return Boolean(settings.isEnabled && settings.callStartsAt);
}

export function isValueCallUpcoming(settings: {
  callStartsAt: Date | null;
  isEnabled: boolean;
}): boolean {
  if (!settings.callStartsAt || !settings.isEnabled) return false;
  return Date.now() < settings.callStartsAt.getTime();
}
