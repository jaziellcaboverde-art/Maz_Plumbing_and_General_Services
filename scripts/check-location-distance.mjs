// Phase 4.8 live check. Creates a temporary nearby provider, checks the live
// PostGIS function returns providers in ascending distance order, then removes it.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Values may already exist in the environment.
}

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_TEST_PASSWORD;
if (!url || !serviceKey) throw new Error("Set the Supabase URL and service key in .env.local.");
if (!password || password.length < 8) throw new Error("Set SEED_TEST_PASSWORD in .env.local.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let temporaryUserId;

try {
  const created = await supabase.auth.admin.createUser({
    email: `capstone-location-sort-${Date.now()}@example.com`,
    password,
    email_confirm: true,
    app_metadata: { role: "provider" },
  });
  if (created.error) throw new Error(`Could not create temporary provider: ${created.error.message}`);
  temporaryUserId = created.data.user.id;

  const profile = await supabase.from("profiles").update({ first_name: "Temporary", last_name: "Location Test", role: "provider" }).eq("id", temporaryUserId);
  if (profile.error) throw new Error(`Could not set temporary provider role: ${profile.error.message}`);

  const provider = await supabase.from("provider_profiles").insert({
    profile_id: temporaryUserId,
    status: "approved",
    daily_rate: 1500,
    base_location: "SRID=4326;POINT(121.10000 14.60000)",
  });
  if (provider.error) throw new Error(`Could not create temporary provider profile: ${provider.error.message}`);

  const result = await supabase.rpc("find_nearby_approved_providers", {
    p_longitude: 121.09564,
    p_latitude: 14.59727,
    p_radius_m: 200000,
    p_service_id: null,
  });
  if (result.error) throw new Error(`Distance search failed: ${result.error.message}`);
  const distances = result.data.map((row) => row.distance_m);
  const sorted = distances.every((distance, index) => index === 0 || distances[index - 1] <= distance);
  if (result.data.length < 2 || !sorted || result.data[0].provider_id !== temporaryUserId) {
    throw new Error(`Distance order check failed: ${result.data.length} providers; ascending=${sorted}; closest is temporary=${result.data[0]?.provider_id === temporaryUserId}`);
  }
  console.log(`PASS: ${result.data.length} providers returned in ascending distance order.`);
  console.log(`Distances in metres: ${distances.map((distance) => Math.round(distance)).join(", ")}`);
} finally {
  if (temporaryUserId) {
    const deleted = await supabase.auth.admin.deleteUser(temporaryUserId);
    if (deleted.error) throw new Error(`Distance check ended; temporary provider cleanup failed: ${deleted.error.message}`);
    console.log("Temporary provider test record removed.");
  }
}
