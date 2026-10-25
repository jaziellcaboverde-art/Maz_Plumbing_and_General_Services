// Phase 3.8: create one test email and in-app notification for an existing account.
// Run only against the development project with the recipient's real email.

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment variables may already be set by the caller.
}

function stop(message) {
  console.error(message);
  process.exit(1);
}

const recipientEmail = process.argv[2]?.trim().toLowerCase();
if (!recipientEmail || !recipientEmail.includes("@")) {
  stop("Usage: npm.cmd run notify:test -- your-email@example.com");
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = process.env.NOTIFICATION_WORKER_SECRET;
const workerUrl = (process.env.NOTIFICATION_WORKER_URL ?? "http://localhost:3000").replace(/\/$/, "");
const brevoKey = process.env.BREVO_API_KEY;
const from = process.env.NOTIFICATION_FROM_EMAIL;
const replyTo = process.env.NOTIFICATION_REPLY_TO_EMAIL?.trim().toLowerCase();

if (!url || !serviceKey) stop("Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.");
if (!workerSecret) stop("Add NOTIFICATION_WORKER_SECRET to .env.local.");
if (!brevoKey || !from || !replyTo) {
  stop("Add BREVO_API_KEY, NOTIFICATION_FROM_EMAIL, and NOTIFICATION_REPLY_TO_EMAIL to .env.local.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let matchingUser;
for (let page = 1; !matchingUser; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) stop(`Could not look up the account: ${error.message}`);
  matchingUser = data.users.find((user) => user.email?.toLowerCase() === recipientEmail);
  if (matchingUser || data.users.length < 1000) break;
}
if (!matchingUser) stop("No Supabase account has that email. Use an email that already has an app profile.");

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id, role")
  .eq("id", matchingUser.id)
  .maybeSingle();
if (profileError) stop(`Could not look up the app profile: ${profileError.message}`);
if (!profile) stop("That account has no MAZ Plumbing and General Services profile yet. Sign in once to finish profile setup, then retry.");

const { data: settings, error: settingsError } = await supabase
  .from("user_settings")
  .select("notification_prefs")
  .eq("profile_id", profile.id)
  .maybeSingle();
if (settingsError) stop(`Could not read notification preferences: ${settingsError.message}`);
if (settings?.notification_prefs?.email_enabled === false) {
  stop("Email is turned off for this account. Turn it back on for this test, or test the in-app alert later.");
}

const { data: deliveries, error: insertError } = await supabase
  .from("notification_deliveries")
  .insert(["in_app", "email"].map((channel) => ({
    profile_id: profile.id,
    event: "manual.test",
    channel,
    title: "MAZ Plumbing and General Services notification test",
    body: "This test checks email and in-app notification delivery.",
  })))
  .select("id, channel");
if (insertError || !deliveries) stop(`Could not queue the test: ${insertError?.message ?? "No rows returned."}`);

try {
  const response = await fetch(`${workerUrl}/api/notifications/worker`, {
    method: "POST",
    headers: { authorization: `Bearer ${workerSecret}` },
  });
  const result = await response.json();
  if (!response.ok) stop(`Worker failed (${response.status}): ${result.error ?? "Unknown error."}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Could not reach the worker.";
  stop(`Could not reach ${workerUrl}/api/notifications/worker: ${message}`);
}

const { data: results, error: resultError } = await supabase
  .from("notification_deliveries")
  .select("channel, status, last_error")
  .in("id", deliveries.map((delivery) => delivery.id))
  .order("channel");
if (resultError || !results) stop(`Could not read test results: ${resultError?.message ?? "No rows returned."}`);

for (const result of results) {
  console.log(`${result.channel}: ${result.status}${result.last_error ? ` — ${result.last_error}` : ""}`);
}
console.log(`Open /${profile.role}/notifications while signed in as this account to check the in-app alert.`);
