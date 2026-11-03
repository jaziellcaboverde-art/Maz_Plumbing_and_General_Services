import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { deliverClaimedDelivery, type NotificationDelivery } from "./delivery";
import { safeAppLink } from "./links";
import { isEmailNotificationEnabled } from "./preferences";
import { enabledNotificationChannels } from "./preference-policy";

export const NOTIFICATION_CHANNELS = ["in_app", "email"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export type NotificationInput = {
  profileId: string;
  event: string;
  category?: "booking" | "account" | "announcement";
  title: string;
  body?: string;
  /** A path inside this app, such as `/customer/bookings`. */
  link?: string;
  channels: readonly NotificationChannel[];
};

export type ChannelResult = {
  channel: NotificationChannel;
  ok: boolean;
  error?: string;
  skipped?: boolean;
};

/** Queue one delivery per selected channel, then make the first attempt immediately. */
export async function sendNotification(input: NotificationInput): Promise<ChannelResult[]> {
  if (!input.profileId || !input.event.trim() || !input.title.trim()) {
    throw new Error("A notification needs a recipient, event name, and title.");
  }
  if (input.channels.length === 0) {
    throw new Error("Choose at least one notification channel.");
  }
  if (new Set(input.channels).size !== input.channels.length) {
    throw new Error("Notification channels must not contain duplicates.");
  }
  safeAppLink(input.link);

  const emailEnabled = input.channels.includes("email")
    ? await isEmailNotificationEnabled(input.profileId)
    : true;
  const skippedResults: ChannelResult[] = emailEnabled
    ? []
    : [{ channel: "email", ok: true, skipped: true }];
  const channelsToSend = enabledNotificationChannels(input.channels, emailEnabled);
  if (channelsToSend.length === 0) return skippedResults;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_deliveries")
    .insert(channelsToSend.map((channel) => ({
      profile_id: input.profileId,
      event: input.event,
      category: input.category ?? "booking",
      channel,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })))
    .select("*");

  if (error || !data) {
    throw new Error(`Could not queue notification delivery: ${error?.message ?? "No delivery rows returned."}`);
  }

  const deliveries = data as NotificationDelivery[];
  const { data: claimed, error: claimError } = await admin.rpc("claim_notification_deliveries", {
    p_limit: deliveries.length,
    p_ids: deliveries.map((delivery) => delivery.id),
  });

  if (claimError || !claimed) {
    return [...channelsToSend.map((channel) => ({
      channel,
      ok: false,
      error: `Delivery is queued for retry: ${claimError?.message ?? "The worker did not claim it."}`,
    })), ...skippedResults];
  }

  const claimedIds = new Set((claimed as NotificationDelivery[]).map((delivery) => delivery.id));
  const results = await Promise.all(deliveries.map(async (delivery): Promise<ChannelResult> => {
    if (!claimedIds.has(delivery.id)) {
      return { channel: delivery.channel, ok: false, error: "Delivery is queued and will be retried." };
    }
    return deliverClaimedDelivery(delivery);
  }));

  return [...results, ...skippedResults];
}
