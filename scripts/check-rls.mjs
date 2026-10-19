// Step 2.20: each role tries to read and write data it should not reach.
// Run after the migrations are applied and the test data is seeded:
//   npm run check:rls
// Uses the real Supabase project in .env.local. Exits with code 1 if any check fails.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file. Values may already be in the environment.
}

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
  if (error) {
    console.error(`Could not sign in as ${key}: ${error.message}. Run npm run seed:test first.`);
    process.exit(1);
  }
  return { client, id: data.user.id };
}

let failed = 0;
function expect(name, ok, detail = "") {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`FAIL  ${name}${detail ? ` (${detail})` : ""}`);
  }
}
/** A read that returns nothing, or an error, means access was refused. */
const refusedRead = (r) => Boolean(r.error) || !r.data || (Array.isArray(r.data) && r.data.length === 0);
/** A write that errors, or touches no rows, means access was refused. */
const refusedWrite = (r) => Boolean(r.error) || !r.data || (Array.isArray(r.data) && r.data.length === 0);

const anon = createClient(url, anonKey, options);
const admin = await signIn("admin");
const customer = await signIn("customer");
const customer2 = await signIn("customer2");
const provider = await signIn("provider");
const storageRunId = randomUUID();
const storageFilesToClean = [];
const notificationIdsToClean = [];

const sampleService = await service.from("services").select("id").limit(1).single();
if (sampleService.error) {
  console.error("No services found. Run npm run seed:test first.");
  process.exit(1);
}
let bookingId = null;

try {
  const testNotifications = await service.from("notifications").insert([
    { profile_id: customer.id, event: "check-rls.notification", title: `RLS customer ${storageRunId}` },
    { profile_id: provider.id, event: "check-rls.notification", title: `RLS provider ${storageRunId}` },
    { profile_id: admin.id, event: "check-rls.notification", title: `RLS admin ${storageRunId}` },
  ]).select("id, profile_id");
  expect("service creates temporary role-scoped notifications", !testNotifications.error && testNotifications.data?.length === 3, testNotifications.error?.message);
  const notificationByProfile = new Map((testNotifications.data ?? []).map((item) => [item.profile_id, item.id]));
  notificationIdsToClean.push(...(testNotifications.data ?? []).map((item) => item.id));

  // Guests ----------------------------------------------------------------------------
  console.log("\nGuest");
  for (const table of ["profiles", "bookings", "config", "audit_log", "payments", "messages", "notifications"]) {
    expect(`guest cannot read ${table}`, refusedRead(await anon.from(table).select("*").limit(1)));
  }
  const publicServices = await anon.from("services").select("id").limit(1);
  expect("guest can read the service list", !publicServices.error && publicServices.data.length > 0);

  // Customer --------------------------------------------------------------------------
  console.log("\nCustomer");
  const own = await customer.client.from("profiles").select("id");
  expect("customer sees only their own profile", !own.error && own.data.length === 1 && own.data[0].id === customer.id);
  expect(
    "customer cannot read the provider profile",
    refusedRead(await customer.client.from("profiles").select("id").eq("id", provider.id)),
  );
  expect(
    "customer cannot read provider_profiles",
    refusedRead(await customer.client.from("provider_profiles").select("*")),
  );
  await customer.client.from("profiles").update({ role: "admin" }).eq("id", customer.id);
  const roleAfter = await service.from("profiles").select("role").eq("id", customer.id).single();
  expect("customer cannot make themselves admin", roleAfter.data?.role === "customer");
  for (const table of ["config", "audit_log", "payments", "payouts"]) {
    expect(`customer cannot read ${table}`, refusedRead(await customer.client.from(table).select("*").limit(1)));
  }
  const customerNotificationId = notificationByProfile.get(customer.id);
  const providerNotificationId = notificationByProfile.get(provider.id);
  const adminNotificationId = notificationByProfile.get(admin.id);
  const customerNotification = customerNotificationId
    ? await customer.client.from("notifications").select("id").eq("id", customerNotificationId)
    : null;
  expect("customer can read their own notification", Boolean(customerNotification && !customerNotification.error && customerNotification.data.length === 1));
  expect(
    "customer cannot read another user's notification",
    providerNotificationId
      ? refusedRead(await customer.client.from("notifications").select("id").eq("id", providerNotificationId))
      : false,
  );
  const customerMarkRead = customerNotificationId
    ? await customer.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", customerNotificationId).select("id")
    : null;
  expect("customer can mark their own notification read", Boolean(customerMarkRead && !customerMarkRead.error && customerMarkRead.data.length === 1));
  const customerMarkOtherRead = providerNotificationId
    ? await customer.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", providerNotificationId).select("id")
    : null;
  expect("customer cannot mark another user's notification read", Boolean(customerMarkOtherRead && refusedWrite(customerMarkOtherRead)));

  const badInsert = await customer.client
    .from("bookings")
    .insert({ customer_id: customer.id, service_id: sampleService.data.id, status: "open" })
    .select();
  expect("customer cannot create a booking that starts as open", Boolean(badInsert.error));

  const draft = await customer.client
    .from("bookings")
    .insert({ customer_id: customer.id, service_id: sampleService.data.id, description: "check-rls test" })
    .select()
    .single();
  expect("customer can create a draft booking", !draft.error && draft.data?.status === "draft", draft.error?.message);
  bookingId = draft.data?.id ?? null;

  if (bookingId) {
    expect(
      "customer cannot set status directly",
      refusedWrite(await customer.client.from("bookings").update({ status: "accepted" }).eq("id", bookingId).select()),
    );
    expect(
      "customer cannot set the price directly",
      refusedWrite(await customer.client.from("bookings").update({ quote_total: 1 }).eq("id", bookingId).select()),
    );
    const skip = await customer.client.rpc("change_booking_status", { p_booking_id: bookingId, p_to: "accepted" });
    expect("customer cannot jump draft to accepted", Boolean(skip.error));
    expect(
      "other customer cannot read this booking",
      refusedRead(await customer2.client.from("bookings").select("id").eq("id", bookingId)),
    );
    expect(
      "provider cannot read a draft booking",
      refusedRead(await provider.client.from("bookings").select("id").eq("id", bookingId)),
    );
    const providerMove = await provider.client.rpc("change_booking_status", { p_booking_id: bookingId, p_to: "open" });
    expect("provider cannot submit the customer's booking", Boolean(providerMove.error));
    const submit = await customer.client.rpc("change_booking_status", { p_booking_id: bookingId, p_to: "open" });
    expect("customer can submit draft to open", !submit.error, submit.error?.message);
    const guestMove = await anon.rpc("change_booking_status", { p_booking_id: bookingId, p_to: "offered" });
    expect("guest cannot change a status", Boolean(guestMove.error));
  }

  // Provider --------------------------------------------------------------------------
  console.log("\nProvider");
  expect(
    "provider cannot read the customer profile",
    refusedRead(await provider.client.from("profiles").select("id").eq("id", customer.id)),
  );
  const ownProvider = await provider.client.from("provider_profiles").select("status");
  expect("provider can read their own provider profile", !ownProvider.error && ownProvider.data.length === 1);
  const providerNotification = providerNotificationId
    ? await provider.client.from("notifications").select("id").eq("id", providerNotificationId)
    : null;
  expect("provider can read their own notification", Boolean(providerNotification && !providerNotification.error && providerNotification.data.length === 1));
  expect(
    "provider cannot read another user's notification",
    customerNotificationId
      ? refusedRead(await provider.client.from("notifications").select("id").eq("id", customerNotificationId))
      : false,
  );
  const providerMarkRead = providerNotificationId
    ? await provider.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", providerNotificationId).select("id")
    : null;
  expect("provider can mark their own notification read", Boolean(providerMarkRead && !providerMarkRead.error && providerMarkRead.data.length === 1));
  expect(
    "provider cannot approve themselves",
    refusedWrite(await provider.client.from("provider_profiles").update({ status: "approved" }).eq("profile_id", provider.id).select()),
  );
  for (const table of ["config", "audit_log", "payments", "cash_records"]) {
    expect(`provider cannot read ${table}`, refusedRead(await provider.client.from(table).select("*").limit(1)));
  }

  // Admin -----------------------------------------------------------------------------
  console.log("\nAdmin");
  const profiles = await admin.client.from("profiles").select("id");
  expect("admin reads every profile", !profiles.error && profiles.data.length >= 4);
  const adminNotification = adminNotificationId
    ? await admin.client.from("notifications").select("id").eq("id", adminNotificationId)
    : null;
  expect("admin can read their own notification", Boolean(adminNotification && !adminNotification.error && adminNotification.data.length === 1));
  expect(
    "admin cannot read another user's notification",
    customerNotificationId
      ? refusedRead(await admin.client.from("notifications").select("id").eq("id", customerNotificationId))
      : false,
  );
  const adminMarkRead = adminNotificationId
    ? await admin.client.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", adminNotificationId).select("id")
    : null;
  expect("admin can mark their own notification read", Boolean(adminMarkRead && !adminMarkRead.error && adminMarkRead.data.length === 1));
  const config = await admin.client.from("config").select("key");
  expect("admin reads config", !config.error && config.data.length >= 12);
  const change = await admin.client.from("config").update({ value: 4 }).eq("key", "offer.max_misses").select();
  expect("admin can change a config value", !change.error && change.data.length === 1, change.error?.message);
  await admin.client.from("config").update({ value: 3 }).eq("key", "offer.max_misses");
  const configAudit = await admin.client
    .from("audit_log")
    .select("id")
    .eq("action", "config.change")
    .eq("target_id", "offer.max_misses");
  expect("config changes are written to the audit log", !configAudit.error && configAudit.data.length >= 2);
  if (bookingId) {
    const statusAudit = await admin.client.from("audit_log").select("id").eq("action", "booking.status").eq("target_id", bookingId);
    expect("status changes are written to the audit log", !statusAudit.error && statusAudit.data.length >= 1);
    const adminThread = await admin.client.from("bookings").select("id").eq("id", bookingId);
    expect("admin can read any booking", !adminThread.error && adminThread.data.length === 1);

    const testMessage = await service
      .from("messages")
      .insert({ booking_id: bookingId, sender_id: customer.id, body: `check-rls ${storageRunId}` })
      .select("id")
      .single();
    expect("service creates a temporary chat message", !testMessage.error, testMessage.error?.message);
    if (testMessage.data?.id) {
      const adminMessage = await admin.client.from("messages").select("id").eq("id", testMessage.data.id);
      expect("admin can read a chat message from any booking", !adminMessage.error && adminMessage.data.length === 1);
      const unrelatedMessage = await customer2.client.from("messages").select("id").eq("id", testMessage.data.id);
      expect("unrelated customer cannot read another booking's chat message", refusedRead(unrelatedMessage));
    }
  }
  const auditEdit = await service.from("audit_log").update({ action: "tampered" }).eq("action", "config.change").select();
  expect("audit log rows cannot be changed, even by the service role", Boolean(auditEdit.error));

  // Storage ---------------------------------------------------------------------------
  console.log("\nStorage");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const idPath = `${provider.id}/check-rls-${storageRunId}.png`;
  const selfiePath = `${provider.id}/check-rls-${storageRunId}.png`;
  const stolenIdPath = `${provider.id}/stolen-${storageRunId}.png`;
  const wrongTypePath = `${provider.id}/check-rls-${storageRunId}.txt`;
  storageFilesToClean.push(["ids", idPath], ["ids", stolenIdPath], ["ids", wrongTypePath], ["selfies", selfiePath]);

  const upload = await provider.client.storage.from("ids").upload(idPath, png, { contentType: "image/png" });
  expect("provider can upload to their own ids folder", !upload.error, upload.error?.message);
  const stolenUpload = await customer.client.storage
    .from("ids")
    .upload(stolenIdPath, png, { contentType: "image/png" });
  expect("customer cannot upload into the provider's ids folder", Boolean(stolenUpload.error));
  const stolenRead = await customer.client.storage.from("ids").download(idPath);
  expect("customer cannot download the provider's id", Boolean(stolenRead.error));
  const adminRead = await admin.client.storage.from("ids").download(idPath);
  expect("admin can download the provider's id", !adminRead.error, adminRead.error?.message);

  const idSigned = await provider.client.storage.from("ids").createSignedUrl(idPath, 60);
  expect("provider can create a signed link for their id", !idSigned.error && Boolean(idSigned.data?.signedUrl), idSigned.error?.message);
  const idSignedFetch = idSigned.data?.signedUrl ? await fetch(idSigned.data.signedUrl).catch(() => null) : null;
  expect("provider's signed id link can download the private file", Boolean(idSignedFetch?.ok));

  const selfieUpload = await provider.client.storage.from("selfies").upload(selfiePath, png, { contentType: "image/png" });
  expect("provider can upload to their own selfies folder", !selfieUpload.error, selfieUpload.error?.message);
  const selfieRead = await admin.client.storage.from("selfies").download(selfiePath);
  expect("admin can download a provider selfie", !selfieRead.error, selfieRead.error?.message);
  const stolenSelfie = await customer.client.storage.from("selfies").download(selfiePath);
  expect("customer cannot download the provider's selfie", Boolean(stolenSelfie.error));

  const wrongType = await provider.client.storage
    .from("ids")
    .upload(wrongTypePath, Buffer.from("hello"), { contentType: "text/plain" });
  expect("a text file is refused in the ids bucket", Boolean(wrongType.error));

  if (bookingId) {
    const linkedBooking = await service
      .from("bookings")
      .update({ provider_id: provider.id })
      .eq("id", bookingId)
      .select("id")
      .single();
    expect("test booking is linked to the provider for storage checks", !linkedBooking.error, linkedBooking.error?.message);

    const receiptPath = `${bookingId}/check-rls-${storageRunId}.png`;
    const proofPath = `${bookingId}/check-rls-${storageRunId}.png`;
    const signaturePath = `${bookingId}/check-rls-${storageRunId}.png`;
    storageFilesToClean.push(
      ["receipts", receiptPath],
      ["proof-photos", proofPath],
      ["signatures", signaturePath],
    );

    const receiptUpload = await customer.client.storage
      .from("receipts")
      .upload(receiptPath, png, { contentType: "image/png" });
    expect("booking customer can upload a receipt", !receiptUpload.error, receiptUpload.error?.message);
    const providerReceipt = await provider.client.storage.from("receipts").download(receiptPath);
    expect("assigned provider can read the booking receipt", !providerReceipt.error, providerReceipt.error?.message);
    const unrelatedReceipt = await customer2.client.storage.from("receipts").download(receiptPath);
    expect("unrelated customer cannot read the booking receipt", Boolean(unrelatedReceipt.error));
    const adminReceipt = await admin.client.storage.from("receipts").download(receiptPath);
    expect("admin can read the booking receipt", !adminReceipt.error, adminReceipt.error?.message);

    const receiptSigned = await customer.client.storage.from("receipts").createSignedUrl(receiptPath, 60);
    expect("booking customer can create a signed receipt link", !receiptSigned.error && Boolean(receiptSigned.data?.signedUrl), receiptSigned.error?.message);
    const receiptSignedFetch = receiptSigned.data?.signedUrl ? await fetch(receiptSigned.data.signedUrl).catch(() => null) : null;
    expect("signed receipt link downloads the private file", Boolean(receiptSignedFetch?.ok));
    const unrelatedSignedReceipt = await customer2.client.storage.from("receipts").createSignedUrl(receiptPath, 60);
    expect(
      "unrelated customer cannot create a signed receipt link",
      Boolean(unrelatedSignedReceipt.error) || !unrelatedSignedReceipt.data?.signedUrl,
    );

    const proofUpload = await provider.client.storage
      .from("proof-photos")
      .upload(proofPath, png, { contentType: "image/png" });
    expect("assigned provider can upload a proof photo", !proofUpload.error, proofUpload.error?.message);
    const customerProof = await customer.client.storage.from("proof-photos").download(proofPath);
    expect("booking customer can read a proof photo", !customerProof.error, customerProof.error?.message);
    const unrelatedProof = await customer2.client.storage.from("proof-photos").download(proofPath);
    expect("unrelated customer cannot read a proof photo", Boolean(unrelatedProof.error));

    const browserSignatureUpload = await customer.client.storage
      .from("signatures")
      .upload(signaturePath, png, { contentType: "image/png" });
    expect("customer cannot upload or replace a signature from the browser", Boolean(browserSignatureUpload.error));
    const serverSignatureUpload = await service.storage
      .from("signatures")
      .upload(signaturePath, png, { contentType: "image/png" });
    expect("trusted server can save a signature", !serverSignatureUpload.error, serverSignatureUpload.error?.message);
    const customerSignature = await customer.client.storage.from("signatures").download(signaturePath);
    expect("booking customer can read the saved signature", !customerSignature.error, customerSignature.error?.message);
    const unrelatedSignature = await customer2.client.storage.from("signatures").download(signaturePath);
    expect("unrelated customer cannot read the signature", Boolean(unrelatedSignature.error));
    const signatureSigned = await customer.client.storage.from("signatures").createSignedUrl(signaturePath, 60);
    expect("booking customer can create a signed signature link", !signatureSigned.error && Boolean(signatureSigned.data?.signedUrl), signatureSigned.error?.message);
    const signatureSignedFetch = signatureSigned.data?.signedUrl ? await fetch(signatureSigned.data.signedUrl).catch(() => null) : null;
    expect("signed signature link downloads the private file", Boolean(signatureSignedFetch?.ok));
  }
} finally {
  // Clean up what this script made.
  if (notificationIdsToClean.length) {
    const { error } = await service.from("notifications").delete().in("id", notificationIdsToClean);
    if (error) {
      failed += 1;
      console.error(`FAIL  cleanup test notifications (${error.message})`);
    }
  }
  for (const [bucket, path] of storageFilesToClean) {
    const { error } = await service.storage.from(bucket).remove([path]);
    if (error) {
      failed += 1;
      console.error(`FAIL  cleanup ${bucket} test file (${error.message})`);
    }
  }
  if (bookingId) await service.from("bookings").delete().eq("id", bookingId);
}

console.log(failed === 0 ? "\nAll checks passed." : `\n${failed} check(s) failed.`);
process.exit(failed === 0 ? 0 : 1);
