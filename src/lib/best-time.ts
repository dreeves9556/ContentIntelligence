export const DAY_NAMES = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
] as const;

export const DAY_LABELS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface BestSlot {
  day: number; // 0-6 (0 = Sunday)
  hour: number; // 0-23 UTC
  engagement: number;
}

export interface HeatmapData {
  grid: number[][]; // [7][24] — engagement values
  bestSlots: BestSlot[]; // top slots overall, sorted desc
}

/**
 * Normalizes an arbitrary Zernio best-time API response into a 7×24 grid.
 * Handles multiple possible response shapes defensively.
 */
export function normalizeBestTimeResponse(raw: unknown): HeatmapData {
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  const setCell = (day: number, hour: number, value: number) => {
    if (day >= 0 && day < 7 && hour >= 0 && hour < 24) {
      grid[day][hour] = value;
    }
  };

  const root = (raw ?? {}) as Record<string, unknown>;

  // Shape 1: { heatmap: { "0": { "0": 12.5, ... }, ... } } — day→hour→value
  if (root.heatmap && typeof root.heatmap === "object") {
    const hm = root.heatmap as Record<string, unknown>;
    for (const [dayKey, hourMap] of Object.entries(hm)) {
      const day = Number(dayKey);
      if (Array.isArray(hourMap)) {
        // Shape 2: { heatmap: { "0": [{hour, engagement}, ...] } }
        for (const slot of hourMap as Record<string, unknown>[]) {
          setCell(day, Number(slot.hour), Number(slot.engagement ?? slot.value ?? 0));
        }
      } else if (hourMap && typeof hourMap === "object") {
        for (const [hourKey, val] of Object.entries(hourMap as Record<string, unknown>)) {
          setCell(day, Number(hourKey), Number(val));
        }
      }
    }
  }

  // Shape 3: { slots: [{day_of_week, hour, avg_engagement}, ...] } — flat array (Zernio API format)
  if (Array.isArray(root.slots)) {
    for (const slot of root.slots as Record<string, unknown>[]) {
      const day = Number(slot.day_of_week ?? slot.day);
      const hour = Number(slot.hour);
      const value = Number(slot.avg_engagement ?? slot.engagement ?? slot.value ?? 0);
      setCell(day, hour, value);
    }
  }

  // Shape 4: { grid: [[...24...], ...7...] } — pre-normalized
  if (Array.isArray(root.grid)) {
    const g = root.grid as unknown[][];
    for (let d = 0; d < Math.min(g.length, 7); d++) {
      const row = g[d];
      if (Array.isArray(row)) {
        for (let h = 0; h < Math.min(row.length, 24); h++) {
          setCell(d, h, Number(row[h]));
        }
      }
    }
  }

  const bestSlots = computeBestSlots(grid, 10);
  return { grid, bestSlots };
}

export function computeBestSlots(grid: number[][], topN = 10): BestSlot[] {
  const slots: BestSlot[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (grid[d]?.[h] > 0) {
        slots.push({ day: d, hour: h, engagement: grid[d][h] });
      }
    }
  }
  slots.sort((a, b) => b.engagement - a.engagement);
  return slots.slice(0, topN);
}

/**
 * Returns the best posting hour for a given day-of-week (0-6).
 * Returns null if no data for that day.
 */
export function bestSlotForDay(grid: number[][], day: number): BestSlot | null {
  const row = grid[day];
  if (!row) return null;
  let best: BestSlot | null = null;
  for (let h = 0; h < 24; h++) {
    if (row[h] > 0 && (!best || row[h] > best.engagement)) {
      best = { day, hour: h, engagement: row[h] };
    }
  }
  return best;
}

/**
 * Returns the top N posting hours for a given day-of-week (0-6), sorted desc.
 */
export function topSlotsForDay(grid: number[][], day: number, topN = 3): BestSlot[] {
  const row = grid[day];
  if (!row) return [];
  const slots: BestSlot[] = [];
  for (let h = 0; h < 24; h++) {
    if (row[h] > 0) slots.push({ day, hour: h, engagement: row[h] });
  }
  slots.sort((a, b) => b.engagement - a.engagement);
  return slots.slice(0, topN);
}

export function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function formatHourShort(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  if (hour < 12) return `${hour}a`;
  return `${hour - 12}p`;
}

export function dayNameToIndex(dayName: string): number {
  const upper = dayName.toUpperCase();
  return DAY_NAMES.findIndex((d) => d === upper);
}

/**
 * Returns the user's local timezone offset in hours (positive = west of UTC).
 * Uses the browser's current offset — handles DST automatically for the current date.
 * Must only be called client-side.
 */
export function getTimezoneOffsetHours(): number {
  return -new Date().getTimezoneOffset() / 60;
}

/**
 * Returns a short timezone label for display, e.g. "America/New_York (UTC-5)".
 * Must only be called client-side.
 */
export function getTimezoneLabel(): string {
  const offset = getTimezoneOffsetHours();
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Local";
  return `${tzName} (UTC${formatOffset(offset)})`;
}

/**
 * Formats a numeric offset as a string like "-5" or "+5:30".
 */
export function formatOffset(offsetHours: number): string {
  const sign = offsetHours >= 0 ? "+" : "";
  const absOffset = Math.abs(offsetHours);
  const hh = Math.floor(absOffset);
  const mm = Math.round((absOffset - hh) * 60);
  return mm > 0 ? `${sign}${hh}:${String(mm).padStart(2, "0")}` : `${sign}${hh}`;
}

/**
 * Shifts a 7×24 UTC grid to the user's local timezone.
 * Each UTC cell (day, hour) is remapped to the corresponding local day & hour.
 * Returns a new grid — does not mutate the input.
 */
export function shiftGridToTimezone(grid: number[][], offsetHours: number): number[][] {
  const localGrid: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0)
  );

  for (let utcDay = 0; utcDay < 7; utcDay++) {
    for (let utcHour = 0; utcHour < 24; utcHour++) {
      const val = grid[utcDay]?.[utcHour] ?? 0;
      if (val === 0) continue;

      // local = UTC + offsetHours
      const totalLocalHours = utcHour + offsetHours;
      const localHour = ((totalLocalHours % 24) + 24) % 24;
      const dayShift = Math.floor(totalLocalHours / 24);
      const localDay = ((utcDay + dayShift) % 7 + 7) % 7;

      // Accumulate in case multiple UTC cells map to the same local cell
      localGrid[localDay][localHour] = Math.max(localGrid[localDay][localHour], val);
    }
  }

  return localGrid;
}

/**
 * Converts a full HeatmapData object from UTC to the user's local timezone.
 * Recomputes bestSlots from the shifted grid.
 */
export function heatmapToLocalTime(data: HeatmapData, offsetHours: number): HeatmapData {
  const localGrid = shiftGridToTimezone(data.grid, offsetHours);
  return {
    grid: localGrid,
    bestSlots: computeBestSlots(localGrid, data.bestSlots.length || 10),
  };
}
