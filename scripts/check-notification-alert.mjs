// Phase 3.6: verify the worker creates one in-app admin alert for a final failed delivery.
// This queues no email. It creates and removes temporary database rows.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment variables may already be set by the caller.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = process.env.NOTIFICATION_WORKER_SECRET;
const workerUrl = (process.env.NOTIFICATION_WORKER_URL ?? "http://localhost:3000").replace(/\/$/, "");
if (!url || !serviceKey || !workerSecret) {
  console.error("Add the Supabase service key and NOTIFICATION_WORKER_SECRET to .env.local.");
  process.exit(1);
}

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let failed = 0;
let deliveryId;
function expect(name, passed, detail = "") {
  if (passed) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` (${detail})` : ""}`);
  }
}

async function runWorker() {
  const response = await fetch(`${workerUrl}/api/notifications/worker`, {
    method: "POST",
    headers: { authorization: `Bearer ${workerSecret}` },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Worker failed (${response.status}): ${result.error ?? "Unknown error."}`);
}

try {
  const now = new Date().toISOString();
  const [pending, stale, unalerted] = await Promise.all([
    service.from("notification_deliveries").select("id", { count: "exact", head: true })
      .eq("status", "pending").lte("next_attempt_at", now).lt("attempts", 3),
    service.from("notification_deliveries").select("id", { count: "exact", head: true })
      .eq("status", "processing").lt("processing_started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString()),
    service.from("notification_deliveries").select("id", { count: "exact", head: true })
      .eq("status", "failed").is("admin_alerted_at", null),
  ]);
  if (pending.error || stale.error || unalerted.error) {
    const detail = [pending.error, stale.error, unalerted.error].filter(Boolean).map((error) => error.message).join("; ");
    throw new Error(`Could not check the worker queue before the isolated alert test: ${detail}`);
  }
  if ((pending.count ?? 0) > 0 || (stale.count ?? 0) > 0 || (unalerted.count ?? 0) > 0) {
    throw new Error("The worker has other due or unalerted deliveries. Run npm.cmd run notify:retry first, then retry this isolated check.");
  }

  const { data: admins, error: adminError } = await service.from("profiles").select("id").eq("role", "admin");
  if (adminError || !admins?.length) throw new Error(adminError?.message ?? "No admin profile found. Run npm run seed:test first.");

  const { data: delivery, error: insertError } = await service.from("notification_deliveries").insert({
    profile_id: admins[0].id,
    event: `phase3.alert.check.${randomUUID()}`,
    channel: "email",
    title: "Temporary failed-delivery alert check",
    status: "failed",
    attempts: 3,
    next_attempt_at: new Date().toISOString(),
    last_error: "Intentional Phase 3.6 final-failure-path check",
  }).select("id").single();
  if (insertError || !delivery) throw new Error(`Could not create temporary failed delivery: ${insertError?.message ?? "No row returned."}`);
  deliveryId = delivery.id;

  await runWorker();
  const { data: firstAlerts, error: firstError } = await service.from("notifications")
    .select("id, profile_id")
    .eq("alert_for_delivery_id", deliveryId);
  expect("worker creates one admin alert for each admin", !firstError && firstAlerts?.length === admins.length, firstError?.message);

  await runWorker();
  const { data: secondAlerts, error: secondError } = await service.from("notifications")
    .select("id")
    .eq("alert_for_delivery_id", deliveryId);
  expect("re-running the worker does not duplicate the admin alert", !secondError && secondAlerts?.length === admins.length, secondError?.message);

  const { data: checkedDelivery, error: checkError } = await service.from("notification_deliveries")
    .select("admin_alerted_at")
    .eq("id", deliveryId)
    .single();
  expect("delivery log records that admins were alerted", !checkError && Boolean(checkedDelivery?.admin_alerted_at), checkError?.message);
} catch (error) {
  failed += 1;
  console.error(error instanceof Error ? error.message : "Notification alert check failed.");
} finally {
  if (deliveryId) {
    const { error: alertCleanupError } = await service.from("notifications").delete().eq("alert_for_delivery_id", deliveryId);
    if (alertCleanupError) {
      failed += 1;
      console.error(`FAIL  clean up temporary admin alerts (${alertCleanupError.message})`);
    }
    const { error: deliveryCleanupError } = await service.from("notification_deliveries").delete().eq("id", deliveryId);
    if (deliveryCleanupError) {
      failed += 1;
      console.error(`FAIL  clean up temporary delivery (${deliveryCleanupError.message})`);
    }
  }
}

console.log(failed === 0 ? "\nNotification admin-alert checks passed." : `\n${failed} notification alert check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
