try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment variables may already be set by the caller.
}

const secret = process.env.NOTIFICATION_WORKER_SECRET;
if (!secret) {
  console.error("Add NOTIFICATION_WORKER_SECRET to .env.local before running notification retries.");
  process.exit(1);
}

const baseUrl = (process.env.NOTIFICATION_WORKER_URL ?? "http://localhost:3000").replace(/\/$/, "");
try {
  const response = await fetch(`${baseUrl}/api/notifications/worker`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const result = await response.json();
  if (!response.ok) {
    console.error(`Notification worker failed (${response.status}): ${result.error ?? "Unknown error."}`);
    process.exit(1);
  }
  console.log(`Notification worker finished: ${result.claimed} claimed, ${result.sent} sent, ${result.retryScheduled} retries scheduled, ${result.adminAlerts} admin alerts.`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Could not reach the notification worker.";
  console.error(`Could not reach ${baseUrl}/api/notifications/worker: ${message}`);
  process.exit(1);
}
