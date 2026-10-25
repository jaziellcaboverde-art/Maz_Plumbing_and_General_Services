import type { NotificationChannel, NotificationInput } from "@/lib/notifications/send";

const CHANNELS: readonly NotificationChannel[] = ["in_app", "email"];

/**
 * The database functions return a "notify" list of people to tell. The server checks every item
 * before sending, so a malformed row is skipped instead of failing the whole request.
 */
export function parseNotifyIntents(value: unknown): NotificationInput[] {
  if (!Array.isArray(value)) return [];
  const out: NotificationInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const profileId = typeof row.profile_id === "string" ? row.profile_id : "";
    const event = typeof row.event === "string" ? row.event : "";
    const title = typeof row.title === "string" ? row.title : "";
    if (!profileId || !event.trim() || !title.trim()) continue;
    const channels = Array.isArray(row.channels)
      ? Array.from(new Set(row.channels.filter((c): c is NotificationChannel => CHANNELS.includes(c as NotificationChannel))))
      : [];
    if (channels.length === 0) continue;
    const link = typeof row.link === "string" && row.link.startsWith("/") && !row.link.startsWith("//") ? row.link : undefined;
    out.push({
      profileId,
      event,
      title,
      body: typeof row.body === "string" ? row.body : undefined,
      link,
      channels,
    });
  }
  return out;
}
