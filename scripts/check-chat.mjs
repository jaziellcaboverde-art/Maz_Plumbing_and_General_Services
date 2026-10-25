// Step 8.9: other users cannot read a booking thread, admin can, and the Phase 8 rules hold.
// Run after `npx supabase db push` and `npm run seed:test`:
//   npm run chat:test
// Uses the real Supabase project in .env.local. Exits with code 1 if any check fails.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

try { process.loadEnvFile(".env.local"); } catch { /* values may already be in the environment */ }

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_TEST_PASSWORD;
if (!url || !anonKey || !serviceKey || !password) {
  console.error("Fill the Supabase keys and SEED_TEST_PASSWORD in .env.local, then run npm run seed:test first.");
  process.exit(1);
}

const EMAILS = {
  admin: "capstone-test-admin@example.com",
  customer: "capstone-test-customer@example.com",
  customer2: "capstone-test-customer2@example.com",
  provider: "capstone-test-provider@example.com",
};
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, serviceKey, options);

async function signIn(key) {
  const client = createClient(url, anonKey, options);
  const { data, error } = await client.auth.signInWithPassword({ email: EMAILS[key], password });
  if (error) { console.error(`Could not sign in as ${key}: ${error.message}. Run npm run seed:test first.`); process.exit(1); }
  return { client, id: data.user.id };
}

let failed = 0;
function expect(name, ok, detail = "") {
  if (ok) console.log(`PASS  ${name}`);
  else { failed += 1; console.log(`FAIL  ${name}${detail ? ` (${detail})` : ""}`); }
}
const refused = (r) => Boolean(r.error) || !r.data || (Array.isArray(r.data) && r.data.length === 0);

const admin = await signIn("admin");
const customer = await signIn("customer");
const customer2 = await signIn("customer2");
const provider = await signIn("provider");

const sampleService = await service.from("services").select("id").limit(1).single();
if (sampleService.error) { console.error("No services found. Run npm run seed:test first."); process.exit(1); }

// A booking that already has its provider, so the chat exists. The service key skips the status rules.
const booking = await service.from("bookings")
  .insert({ customer_id: customer.id, provider_id: provider.id, service_id: sampleService.data.id, description: "check-chat test" })
  .select("id").single();
if (booking.error) { console.error(`Could not create the test booking: ${booking.error.message}`); process.exit(1); }
const bookingId = booking.data.id;
const otherBookingId = randomUUID();
const photoPaths = [];
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

try {
  // Sending: only the two people on the booking.
  const fromCustomer = await customer.client.from("messages").insert({ booking_id: bookingId, sender_id: customer.id, body: "hello from the customer" }).select().single();
  expect("customer can send in their booking chat", !fromCustomer.error, fromCustomer.error?.message);
  const fromProvider = await provider.client.from("messages").insert({ booking_id: bookingId, sender_id: provider.id, body: "hello from the provider" }).select().single();
  expect("assigned provider can send", !fromProvider.error, fromProvider.error?.message);
  expect("another customer cannot send", Boolean((await customer2.client.from("messages").insert({ booking_id: bookingId, sender_id: customer2.id, body: "intruder" }).select()).error));
  expect("admin cannot send (read only)", Boolean((await admin.client.from("messages").insert({ booking_id: bookingId, sender_id: admin.id, body: "admin" }).select()).error));
  expect("nobody can send as someone else", Boolean((await customer2.client.from("messages").insert({ booking_id: bookingId, sender_id: customer.id, body: "spoof" }).select()).error));

  // Reading: parties and admin only.
  const customerRead = await customer.client.from("messages").select("id").eq("booking_id", bookingId);
  expect("customer reads the thread", !customerRead.error && customerRead.data.length === 2);
  const providerRead = await provider.client.from("messages").select("id").eq("booking_id", bookingId);
  expect("provider reads the thread", !providerRead.error && providerRead.data.length === 2);
  expect("admin reads the thread", (await admin.client.from("messages").select("id").eq("booking_id", bookingId)).data?.length === 2);
  expect("another customer cannot read the thread", refused(await customer2.client.from("messages").select("id").eq("booking_id", bookingId)));

  // Unread (8.4).
  const unreadOf = async (who) => Number((await who.client.rpc("chat_unread_counts")).data?.find((row) => row.booking_id === bookingId)?.unread ?? 0);
  expect("provider has 1 unread message from the customer", (await unreadOf(provider)) === 1);
  expect("customer has 1 unread message from the provider", (await unreadOf(customer)) === 1);
  expect("provider can mark the thread read", !(await provider.client.rpc("mark_chat_read", { p_booking_id: bookingId })).error);
  expect("provider's unread count drops to 0", (await unreadOf(provider)) === 0);
  expect("customer's own count is not changed by the provider reading", (await unreadOf(customer)) === 1);
  expect("another customer cannot mark the thread read", Boolean((await customer2.client.rpc("mark_chat_read", { p_booking_id: bookingId })).error));
  expect("admin has no unread tracking", Boolean((await admin.client.rpc("mark_chat_read", { p_booking_id: bookingId })).error));
  expect("another customer sees no unread for this booking", (await unreadOf(customer2)) === 0);

  // Flags (8.6).
  const messageId = fromCustomer.data?.id;
  expect("customer cannot flag a message", Boolean((await customer.client.rpc("flag_message", { p_message_id: messageId, p_flagged: true })).error));
  expect("provider cannot flag a message", Boolean((await provider.client.rpc("flag_message", { p_message_id: messageId, p_flagged: true })).error));
  expect("admin can flag a message", !(await admin.client.rpc("flag_message", { p_message_id: messageId, p_flagged: true, p_reason: "check-chat" })).error);
  expect("the message is marked flagged", (await service.from("messages").select("flagged").eq("id", messageId).single()).data?.flagged === true);
  const audit = await service.from("audit_log").select("id").eq("action", "message.flagged").eq("target_id", messageId);
  expect("the flag is written to the audit log", !audit.error && audit.data.length >= 1);
  expect("customer cannot edit a message directly", refused(await customer.client.from("messages").update({ flagged: false }).eq("id", messageId).select()));

  // Photos (8.3).
  const path = `${bookingId}/${randomUUID()}.png`;
  const upload = await customer.client.storage.from("chat-photos").upload(path, png, { contentType: "image/png" });
  expect("customer can upload a chat photo", !upload.error, upload.error?.message);
  if (!upload.error) photoPaths.push(path);
  const intruderPath = `${bookingId}/${randomUUID()}.png`;
  const intruder = await customer2.client.storage.from("chat-photos").upload(intruderPath, png, { contentType: "image/png" });
  if (!intruder.error) photoPaths.push(intruderPath);
  expect("another customer cannot upload into this chat", Boolean(intruder.error));
  const adminPath = `${bookingId}/${randomUUID()}.png`;
  const adminUpload = await admin.client.storage.from("chat-photos").upload(adminPath, png, { contentType: "image/png" });
  if (!adminUpload.error) photoPaths.push(adminPath);
  expect("admin cannot upload into a chat", Boolean(adminUpload.error));
  const badType = await customer.client.storage.from("chat-photos").upload(`${bookingId}/${randomUUID()}.pdf`, Buffer.from("%PDF-1.4"), { contentType: "application/pdf" });
  expect("a PDF is refused", Boolean(badType.error));
  expect("provider can open the photo", !(await provider.client.storage.from("chat-photos").createSignedUrl(path, 60)).error);
  expect("admin can open the photo", !(await admin.client.storage.from("chat-photos").createSignedUrl(path, 60)).error);
  expect("another customer cannot open the photo", Boolean((await customer2.client.storage.from("chat-photos").createSignedUrl(path, 60)).error));
  const withPhoto = await customer.client.from("messages").insert({ booking_id: bookingId, sender_id: customer.id, attachment_path: path }).select().single();
  expect("a photo-only message is allowed", !withPhoto.error, withPhoto.error?.message);
  const wrongFolder = await customer.client.from("messages").insert({ booking_id: bookingId, sender_id: customer.id, attachment_path: `${otherBookingId}/x.png` }).select();
  expect("a message cannot point at another booking's folder", Boolean(wrongFolder.error));
} finally {
  if (photoPaths.length) await service.storage.from("chat-photos").remove(photoPaths);
  await service.from("bookings").delete().eq("id", bookingId);
}

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll chat checks passed.");
process.exit(failed ? 1 : 0);
