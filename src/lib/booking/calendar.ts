import type { BookingStatus } from "./rules";

/** Pure helpers for the customer's week calendar. Everything is in Philippine time. */
export const TZ = "Asia/Manila";
export const FIRST_HOUR = 7;
export const LAST_HOUR = 19;

export type StatusGroup = "finding" | "confirmed" | "done" | "cancelled";

export const GROUP_LABELS: Record<StatusGroup, string> = {
  finding: "Finding a provider",
  confirmed: "Confirmed",
  done: "Finished",
  cancelled: "Cancelled",
};

export function groupOf(status: BookingStatus): StatusGroup {
  if (status === "cancelled") return "cancelled";
  if (["done", "signed", "balance_paid", "completed"].includes(status)) return "done";
  if (["deposit_paid", "scheduled", "on_the_way", "in_progress"].includes(status)) return "confirmed";
  return "finding";
}

export type CalendarBooking = {
  id: string;
  status: BookingStatus;
  serviceName: string;
  /** The confirmed time if there is one, otherwise the time the customer asked for. */
  start: string | null;
  isUrgent: boolean;
  /** A second line on the chip, such as who the booking is for. */
  subtitle?: string;
  /** Where the chip links to. Customers get their booking page by default. */
  href?: string;
};

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const hourFormat = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" });
const timeFormat = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

export function manilaDateKey(date: Date): string { return dayFormat.format(date); }
export function manilaHour(date: Date): number { return Number(hourFormat.format(date)); }
export function timeText(iso: string): string { return timeFormat.format(new Date(iso)); }

const utc = (key: string) => new Date(`${key}T00:00:00Z`);

export function addDays(key: string, days: number): string {
  const date = utc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The Monday of the week that holds `key`. */
export function mondayOf(key: string): string {
  const day = utc(key).getUTCDay();
  return addDays(key, day === 0 ? -6 : 1 - day);
}

/** `?week=` can hold any date. Anything that is not a date means this week. */
export function weekFromParam(value: string | undefined, todayKey: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(utc(value).getTime())) return mondayOf(value);
  return mondayOf(todayKey);
}

export type WeekDay = { key: string; weekday: string; day: number };

export function weekDays(monday: string): WeekDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const key = addDays(monday, i);
    const date = utc(key);
    return {
      key,
      weekday: new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "short" }).format(date),
      day: date.getUTCDate(),
    };
  });
}

export function weekTitle(monday: string): string {
  const start = utc(monday);
  const end = utc(addDays(monday, 6));
  const month = (d: Date) => new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" }).format(d);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  return `${month(start)} ${start.getUTCDate()} – ${sameMonth ? "" : `${month(end)} `}${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

export function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 ? "AM" : "PM"}`;
}

export function hours(): number[] {
  return Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
}

/** Puts each dated booking in the cell for its day and hour. Early or late times sit in the first or last row. */
export function placeBookings(bookings: CalendarBooking[], days: WeekDay[]): Map<string, CalendarBooking[]> {
  const cells = new Map<string, CalendarBooking[]>();
  const keys = new Set(days.map((d) => d.key));
  for (const booking of bookings) {
    if (!booking.start) continue;
    const date = new Date(booking.start);
    const key = manilaDateKey(date);
    if (!keys.has(key)) continue;
    const hour = Math.min(LAST_HOUR, Math.max(FIRST_HOUR, manilaHour(date)));
    const cell = `${key}|${hour}`;
    cells.set(cell, [...(cells.get(cell) ?? []), booking]);
  }
  for (const list of cells.values()) list.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  return cells;
}

export function relativeDay(startIso: string, todayKey: string): string {
  const key = manilaDateKey(new Date(startIso));
  const diff = Math.round((utc(key).getTime() - utc(todayKey).getTime()) / 86400000);
  if (diff <= 0) return "today";
  if (diff === 1) return "tomorrow";
  return `in ${diff} days`;
}

/** Current time for server screens, kept out of the components so they stay pure. */
export function now(): { iso: string; todayKey: string } {
  const date = new Date();
  return { iso: date.toISOString(), todayKey: manilaDateKey(date) };
}
