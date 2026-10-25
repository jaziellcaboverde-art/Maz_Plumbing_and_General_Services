import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrevoEmail } from "./brevo-email";
import { renderNotificationEmail } from "./email-template";
import { safeAppLink } from "./links";
import { deliveryFailureTransition } from "./retry-policy";

export type NotificationChannel = "in_app" | "email";
export type ChannelResult = { channel: NotificationChannel; ok: boolean; error?: string };

export type NotificationDelivery = {
  id: string;
  profile_id: string;
  event: string;
  channel: NotificationChannel;
  title: string;
  body: string | null;
  link: string | null;
  attempts: number;
};

async function sendInApp(delivery: NotificationDelivery) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").upsert({
    delivery_id: delivery.id,
    profile_id: delivery.profile_id,
    event: delivery.event,
    title: delivery.title,
    body: delivery.body,
    link: delivery.link,
  }, { onConflict: "delivery_id", ignoreDuplicates: true });
  if (error) throw new Error(`Could not save in-app notification: ${error.message}`);
}

async function sendEmail(delivery: NotificationDelivery) {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(delivery.profile_id);
  if (error) throw new Error(`Could not find notification recipient: ${error.message}`);
  if (!data.user?.email) throw new Error("Notification recipient has no email address.");

  const actionUrl = safeAppLink(delivery.link ?? undefined);
  const content = renderNotificationEmail({ title: delivery.title, body: delivery.body ?? undefined, actionUrl });
  await sendBrevoEmail({
    to: data.user.email,
    subject: delivery.title,
    html: content.html,
    text: content.text,
    idempotencyKey: delivery.id,
  });
}

/** Deliver one claimed row and persist its success or retry schedule. */
export async function deliverClaimedDelivery(delivery: NotificationDelivery): Promise<ChannelResult> {
  const admin = createAdminClient();
  try {
    if (delivery.channel === "in_app") await sendInApp(delivery);
    else await sendEmail(delivery);

    const { error } = await admin.from("notification_deliveries").update({
      status: "sent",
      processing_started_at: null,
      last_error: null,
    }).eq("id", delivery.id).eq("status", "processing");
    if (error) throw new Error(`Delivery succeeded but its log could not be updated: ${error.message}`);
    return { channel: delivery.channel, ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Notification delivery failed.";
    const transition = deliveryFailureTransition(delivery.attempts);
    const { error } = await admin.from("notification_deliveries").update({
      status: transition.status,
      next_attempt_at: transition.nextAttemptAt,
      processing_started_at: null,
      last_error: message,
    }).eq("id", delivery.id).eq("status", "processing");

    return {
      channel: delivery.channel,
      ok: false,
      error: error
        ? `${message} Delivery log update failed: ${error.message}`
        : transition.status === "failed" ? `${message} No retries remain.` : `${message} Retry scheduled in 5 minutes.`,
    };
  }
}
