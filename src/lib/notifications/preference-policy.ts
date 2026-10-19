type NotificationChannel = "in_app" | "email";

/** An absent preference keeps email enabled. In-app notifications always stay enabled. */
export function isEmailPreferenceEnabled(preferences: unknown): boolean {
  return !preferences || typeof preferences !== "object" || Array.isArray(preferences)
    ? true
    : (preferences as Record<string, unknown>).email_enabled !== false;
}

/** Turning email off must leave the in-app channel selected. */
export function enabledNotificationChannels(
  channels: readonly NotificationChannel[],
  emailEnabled: boolean,
): NotificationChannel[] {
  return channels.filter((channel) => channel !== "email" || emailEnabled);
}
