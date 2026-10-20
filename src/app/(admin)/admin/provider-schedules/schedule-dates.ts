function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number): string {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function formatDay(value: string): string {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "short", day: "numeric" }).format(dateAtUtc(value));
}

export function formatWeek(value: string): string {
  const start = dateAtUtc(value);
  const end = dateAtUtc(addDays(value, 6));
  return new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }).formatRange(start, end);
}
