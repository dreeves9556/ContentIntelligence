"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateValueCallSettings } from "@/lib/value-call";

export interface ValueCallSettingsInput {
  title: string;
  description: string;
  callDate: string; // YYYY-MM-DD
  callTime: string; // HH:MM
  timezone: string;
  zoomUrl: string;
  isEnabled: boolean;
}

export interface ValueCallSettingsOutput {
  id: string;
  title: string;
  description: string | null;
  callStartsAt: string | null;
  zoomUrl: string | null;
  timezone: string | null;
  isEnabled: boolean;
}

export async function getValueCallSettingsForAdmin(): Promise<ValueCallSettingsOutput> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const settings = await getOrCreateValueCallSettings();

  return {
    id: settings.id,
    title: settings.title,
    description: settings.description,
    callStartsAt: settings.callStartsAt?.toISOString() ?? null,
    zoomUrl: settings.zoomUrl,
    timezone: settings.timezone,
    isEnabled: settings.isEnabled,
  };
}

export async function updateValueCallSettings(
  input: ValueCallSettingsInput
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (input.isEnabled) {
    if (!input.callDate || !input.callTime) {
      return { success: false, error: "Date and time are required when the Value Call is enabled." };
    }

    if (!input.zoomUrl) {
      return { success: false, error: "Zoom URL is required when the Value Call is enabled." };
    }

    if (!input.zoomUrl.startsWith("https://")) {
      return { success: false, error: "Zoom URL must start with https://" };
    }

    if (!input.title.trim()) {
      return { success: false, error: "Title is required." };
    }
  }

  let callStartsAt: Date | null = null;
  if (input.callDate && input.callTime) {
    const tz = input.timezone || "America/New_York";
    const localString = `${input.callDate}T${input.callTime}:00`;
    try {
      callStartsAt = convertLocalToUTC(localString, tz);
    } catch {
      return { success: false, error: "Invalid date/time or timezone." };
    }
  }

  try {
    await prisma.valueCallSettings.upsert({
      where: { id: "default" },
      update: {
        title: input.title.trim() || "Next Value Call",
        description: input.description.trim() || null,
        callStartsAt,
        zoomUrl: input.zoomUrl.trim() || null,
        timezone: input.timezone || "America/New_York",
        isEnabled: input.isEnabled,
      },
      create: {
        id: "default",
        title: input.title.trim() || "Next Value Call",
        description: input.description.trim() || null,
        callStartsAt,
        zoomUrl: input.zoomUrl.trim() || null,
        timezone: input.timezone || "America/New_York",
        isEnabled: input.isEnabled,
      },
    });
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save settings." };
  }
}

function convertLocalToUTC(localString: string, timezone: string): Date {
  const date = new Date(localString);
  const utcDate = new Date(
    date.toLocaleString("en-US", { timeZone: "UTC" })
  );
  const tzDate = new Date(
    date.toLocaleString("en-US", { timeZone: timezone })
  );
  const offset = utcDate.getTime() - tzDate.getTime();
  return new Date(date.getTime() + offset);
}
