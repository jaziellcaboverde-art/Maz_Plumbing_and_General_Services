import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { deliverClaimedDelivery, type NotificationDelivery } from "./delivery";

type FailedDelivery = Pick<NotificationDelivery, "id" | "event" | "channel" | "attempts">;

async function alertAdmins(delivery: FailedDelivery) {
  const admin = createAdminClient();
  const { data: admins, error: adminError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin");
  if (adminError) throw new Error(`Could not find admins for notification failure alert: ${adminError.message}`);
  if (!admins?.length) return false;

  const { error: alertError } = await admin.from("notifications").upsert(
    admins.map(({ id }) => ({
      profile_id: id,
      event: "notification.delivery_failed",
      title: "A notification could not be delivered",
      body: `An ${delivery.channel} notification for event “${delivery.event}” failed after ${delivery.attempts} attempts.`,
      link: "/admin/notifications",
      alert_for_delivery_id: delivery.id,
    })),
    { onConflict: "alert_for_delivery_id,profile_id", ignoreDuplicates: true },
  );
  if (alertError) throw new Error(`Could not create admin notification alert: ${alertError.message}`);

  const { error: markError } = await admin.from("notification_deliveries")
    .update({ admin_alerted_at: new Date().toISOString() })
    .eq("id", delivery.id)
    .is("admin_alerted_at", null);
  if (markError) throw new Error(`Admin alert was created but could not be logged: ${markError.message}`);
  return true;
}

/** Claim due rows, retry each channel independently, and alert admins once for permanent failures. */
export async function runNotificationRetryWorker(limit = 50) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_deliveries", {
    p_limit: Math.min(Math.max(limit, 1), 100),
    p_ids: null,
  });
  if (error) throw new Error(`Could not claim notification retries: ${error.message}`);

  const deliveries = (data ?? []) as NotificationDelivery[];
  let sent = 0;
  let retryScheduled = 0;
  for (const delivery of deliveries) {
    const result = await deliverClaimedDelivery(delivery);
    if (result.ok) sent += 1;
    else if (delivery.attempts < 3) retryScheduled += 1;
  }

  const { data: failed, error: failedError } = await admin
    .from("notification_deliveries")
    .select("id, event, channel, attempts")
    .eq("status", "failed")
    .is("admin_alerted_at", null)
    .limit(100);
  if (failedError) throw new Error(`Could not list failed notifications: ${failedError.message}`);

  let adminAlerts = 0;
  for (const delivery of (failed ?? []) as FailedDelivery[]) {
    if (await alertAdmins(delivery)) adminAlerts += 1;
  }

  return { claimed: deliveries.length, sent, retryScheduled, adminAlerts };
}
