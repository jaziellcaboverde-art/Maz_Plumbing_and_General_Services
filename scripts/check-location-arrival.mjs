// Phase 4.9/4.10 live check. Uses seeded test accounts and a temporary booking.
// The booking and its test-only work-day records are removed afterward; immutable audit history is retained.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Values may already exist in the environment.
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_TEST_PASSWORD;
if (!url || !anonKey || !serviceKey) throw new Error("Set the Supabase keys in .env.local.");
if (!password || password.length < 8) throw new Error("Set SEED_TEST_PASSWORD in .env.local.");

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const customer = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const provider = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const reviewer = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
let bookingId;

async function signIn(client, email) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Test account sign-in failed for ${email}: ${error.message}`);
}

async function changeStatus(client, id, status, reason) {
  const { error } = await client.rpc("change_booking_status", { p_booking_id: id, p_to: status, p_reason: reason ?? null });
  if (error) throw new Error(`Could not move test booking to ${status}: ${error.message}`);
}

function decodePoint(value) {
  if (typeof value !== "string") throw new Error("Saved customer address has no readable map point.");
  const wkt = value.match(/^POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)$/i);
  if (wkt) return { longitude: Number(wkt[1]), latitude: Number(wkt[2]) };
  if (!/^[\da-f]+$/i.test(value)) throw new Error("Saved customer address map point is not in a supported format.");
  const bytes = Buffer.from(value, "hex");
  if (bytes.length < 25) throw new Error("Saved customer address map point is incomplete.");
  const readDouble = bytes[0] === 1 ? Buffer.prototype.readDoubleLE : Buffer.prototype.readDoubleBE;
  return { longitude: readDouble.call(bytes, 9), latitude: readDouble.call(bytes, 17) };
}

function latitudeOffsetForMeters(latitude, meters) {
  const radians = latitude * Math.PI / 180;
  const metersPerDegree = 111132.92 - 559.82 * Math.cos(2 * radians) + 1.175 * Math.cos(4 * radians);
  return latitude + meters / metersPerDegree;
}

try {
  const { data: { users }, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (usersError) throw new Error(`Could not find seeded test accounts: ${usersError.message}`);
  const customerUser = users.find((user) => user.email === "capstone-test-customer@example.com");
  const providerUser = users.find((user) => user.email === "capstone-test-provider@example.com");
  const adminUser = users.find((user) => user.email === "capstone-test-admin@example.com");
  if (!customerUser || !providerUser || !adminUser) throw new Error("Run npm.cmd run seed:test before this check.");

  const { data: address, error: addressError } = await admin.from("addresses").select("id,location")
    .eq("profile_id", customerUser.id).not("location", "is", null).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (addressError || !address?.location) throw new Error("The test customer needs a saved location first.");
  const point = decodePoint(address.location);

  await signIn(customer, customerUser.email);
  await signIn(provider, providerUser.email);
  await signIn(reviewer, adminUser.email);

  const created = await admin.from("bookings").insert({
    customer_id: customerUser.id,
    address_id: address.id,
    provider_id: providerUser.id,
    picked_provider_id: providerUser.id,
    description: "Temporary Phase 4 arrival verification",
  }).select("id").single();
  if (created.error) throw new Error(`Could not create the temporary booking: ${created.error.message}`);
  bookingId = created.data.id;

  await changeStatus(customer, bookingId, "open");
  await changeStatus(admin, bookingId, "offered");
  await changeStatus(provider, bookingId, "accepted");
  await changeStatus(provider, bookingId, "quoted");
  await changeStatus(admin, bookingId, "deposit_paid");
  await changeStatus(admin, bookingId, "scheduled");
  await changeStatus(provider, bookingId, "on_the_way");

  const outside = await provider.rpc("record_provider_arrival", {
    p_booking_id: bookingId,
    p_longitude: point.longitude,
    p_latitude: latitudeOffsetForMeters(point.latitude, 201),
    p_accuracy_m: 5,
  });
  if (outside.error || outside.data?.[0]?.within_radius !== false) {
    throw new Error(`201 m arrival check did not fail as expected: ${outside.error?.message ?? "unexpected result"}`);
  }
  const before = await admin.from("work_days").select("id").eq("booking_id", bookingId);
  if (before.error || before.data.length !== 0) throw new Error("An outside-radius arrival incorrectly created a work-day record.");
  console.log(`PASS: 201 m rejected (${Math.round(outside.data[0].distance_m)} m); no arrival record created.`);

  const inside = await provider.rpc("record_provider_arrival", {
    p_booking_id: bookingId,
    p_longitude: point.longitude,
    p_latitude: latitudeOffsetForMeters(point.latitude, 199),
    p_accuracy_m: 5,
  });
  if (inside.error || inside.data?.[0]?.within_radius !== true) {
    throw new Error(`199 m arrival check did not pass as expected: ${inside.error?.message ?? "unexpected result"}`);
  }
  const workDay = await admin.from("work_days").select("arrival_distance_m,gps_accuracy_m,admin_override")
    .eq("booking_id", bookingId).maybeSingle();
  if (workDay.error || !workDay.data || Number(workDay.data.gps_accuracy_m) !== 5) {
    throw new Error("Successful arrival did not save distance and GPS accuracy.");
  }
  console.log(`PASS: 199 m accepted (${Math.round(inside.data[0].distance_m)} m); distance and GPS accuracy saved.`);

  const requested = await provider.rpc("request_arrival_override", {
    p_booking_id: bookingId,
    p_reason: "Temporary GPS failure verification",
  });
  if (requested.error || !requested.data) throw new Error(`Override request failed: ${requested.error?.message ?? "no request ID"}`);
  const reviewed = await reviewer.rpc("review_arrival_override", {
    p_request_id: requested.data,
    p_approve: true,
    p_reason: "Approved for temporary Phase 4 verification",
  });
  if (reviewed.error) throw new Error(`Admin override review failed: ${reviewed.error.message}`);
  const override = await admin.from("arrival_override_requests").select("status,review_reason")
    .eq("id", requested.data).maybeSingle();
  if (override.error || override.data?.status !== "approved") throw new Error("Admin override approval was not saved.");
  console.log("PASS: provider override request and admin approval saved.");
} finally {
  if (bookingId) {
    const canceled = await changeStatus(reviewer, bookingId, "cancelled", "Temporary Phase 4 arrival verification complete").then(() => true).catch(() => false);
    if (!canceled) console.warn("Could not cancel the temporary booking; removing it directly.");
    const deleted = await admin.from("bookings").delete().eq("id", bookingId);
    if (deleted.error) console.error("Could not clean up the temporary booking:", deleted.error.message);
    else console.log("Temporary booking and work-day records removed; audit history retained.");
  }
}
