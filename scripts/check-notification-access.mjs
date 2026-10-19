// Phase 3.4: verify notification read and mark-as-read policies for every seeded role.
// Creates temporary rows and deletes them before exit. Run with npm run notify:access:test.

import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // Environment variables may already be set by the caller.
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_TEST_PASSWORD;
if (!url || !anonKey || !serviceKey || !password) {
  console.error("Fill the Supabase keys and SEED_TEST_PASSWORD in .env.local, then run npm run seed:test first.");
  process.exit(1);
}

const emails = {
  admin: "capstone-test-admin@example.com",
  customer: "capstone-test-customer@example.com",
  provider: "capstone-test-provider@example.com",
};
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, options);
const guest = createClient(url, anonKey, options);
const users = {};
let failed = 0;
let insertedIds = [];
let preferenceProfileId;
let originalPreferences;
let preferenceRowCreated = false;

function expect(name, passed, detail = "") {
  if (passed) console.log(`PASS  ${name}`);
  else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` (${detail})` : ""}`);
  }
}

const refusedRead = (result) => Boolean(result.error) || !result.data || result.data.length === 0;
const refusedWrite = (result) => Boolean(result.error) || !result.data || result.data.length === 0;

for (const [role, email] of Object.entries(emails)) {
  const client = createClient(url, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    console.error(`Could not sign in as ${role}: ${error?.message ?? "No user returned."}. Run npm run seed:test first.`);
    process.exit(1);
  }
  users[role] = { client, id: data.user.id };
}
preferenceProfileId = users.customer.id;

const runId = randomUUID();
try {
  const seeded = await service.from("notifications").insert(
    Object.entries(users).map(([role, user]) => ({
      profile_id: user.id,
      event: "check-notification-access",
      title: `Temporary ${role} access check ${runId}`,
    })),
  ).select("id, profile_id");
  expect("service creates temporary role-specific notifications", !seeded.error && seeded.data?.length === 3, seeded.error?.message);
  insertedIds = (seeded.data ?? []).map((row) => row.id);

  const { data: existingSettings, error: settingsError } = await service.from("user_settings")
    .select("notification_prefs")
    .eq("profile_id", preferenceProfileId)
    .maybeSingle();
  if (settingsError) {
    expect("customer email preference can be loaded", false, settingsError.message);
  } else if (existingSettings) {
    originalPreferences = existingSettings.notification_prefs;
    const { error: preferenceUpdateError } = await service.from("user_settings")
      .update({ notification_prefs: { ...originalPreferences, email_enabled: false } })
      .eq("profile_id", preferenceProfileId);
    const { data: disabledSettings, error: verifyError } = await service.from("user_settings")
      .select("notification_prefs")
      .eq("profile_id", preferenceProfileId)
      .single();
    expect("email opt-out is stored per user", !preferenceUpdateError && !verifyError && disabledSettings?.notification_prefs?.email_enabled === false, preferenceUpdateError?.message ?? verifyError?.message);
  } else {
    const { error: preferenceInsertError } = await service.from("user_settings").insert({
      profile_id: preferenceProfileId,
      notification_prefs: { email_enabled: false },
    });
    preferenceRowCreated = !preferenceInsertError;
    expect("email opt-out is stored per user", !preferenceInsertError, preferenceInsertError?.message);
  }

  if (seeded.data?.length === 3) {
    const idByProfile = new Map(seeded.data.map((row) => [row.profile_id, row.id]));
    const allIds = insertedIds;
    expect("guest cannot read notifications", refusedRead(await guest.from("notifications").select("id").in("id", allIds)));

    for (const [role, user] of Object.entries(users)) {
      const ownId = idByProfile.get(user.id);
      const own = ownId
        ? await user.client.from("notifications").select("id").eq("id", ownId)
        : null;
      expect(`${role} can read their own notification`, Boolean(own && !own.error && own.data.length === 1));

      const others = ownId
        ? await user.client.from("notifications").select("id").in("id", allIds).neq("id", ownId)
        : null;
      expect(`${role} cannot read other users' notifications`, Boolean(others && refusedRead(others)));

      const markOwn = ownId
        ? await user.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", ownId).select("id")
        : null;
      expect(`${role} can mark their own notification read`, Boolean(markOwn && !markOwn.error && markOwn.data.length === 1));

      const anotherId = seeded.data.find((row) => row.profile_id !== user.id)?.id;
      const markOther = anotherId
        ? await user.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", anotherId).select("id")
        : null;
      expect(`${role} cannot mark another user's notification read`, Boolean(markOther && refusedWrite(markOther)));
    }
  }
} finally {
  if (preferenceProfileId) {
    const restore = preferenceRowCreated
      ? await service.from("user_settings").delete().eq("profile_id", preferenceProfileId)
      : originalPreferences !== undefined
        ? await service.from("user_settings").update({ notification_prefs: originalPreferences }).eq("profile_id", preferenceProfileId)
        : null;
    if (restore?.error) {
      failed += 1;
      console.error(`FAIL  restore the customer's original notification preference (${restore.error.message})`);
    }
  }
  if (insertedIds.length) {
    const { error } = await service.from("notifications").delete().in("id", insertedIds);
    if (error) {
      failed += 1;
      console.error(`FAIL  clean up temporary notifications (${error.message})`);
    }
  }
}

console.log(failed === 0 ? "\nAll notification access checks passed." : `\n${failed} notification access check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
