// Step 2.19: sample services and one test user per role.
// Run after the migrations are applied and .env.local has the Supabase keys:
//   npm run seed:test
// Needs SEED_TEST_PASSWORD in .env.local (any password you choose, 8 or more characters).
// Safe to run twice. Test data only. Never run this against the live project after launch.

import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local file. Values may already be in the environment.
}

export const TEST_USERS = [
  { key: "admin", email: "capstone-test-admin@example.com", role: "admin", first: "Test", last: "Admin" },
  { key: "customer", email: "capstone-test-customer@example.com", role: "customer", first: "Test", last: "Customer" },
  { key: "customer2", email: "capstone-test-customer2@example.com", role: "customer", first: "Other", last: "Customer" },
  { key: "provider", email: "capstone-test-provider@example.com", role: "provider", first: "Test", last: "Provider" },
];

// Sample services only. Q22 (launch services) is still open.
const SERVICES = [
  { category: "Plumbing", name: "Leak repair", default_class: "minor", urgent_allowed: true, sort_order: 1 },
  { category: "Electrical", name: "Outlet and switch repair", default_class: "minor", urgent_allowed: true, sort_order: 2 },
  { category: "Aircon", name: "Aircon cleaning", default_class: "minor", urgent_allowed: false, sort_order: 3 },
  { category: "Painting", name: "Room repaint", default_class: "minor", urgent_allowed: false, sort_order: 4 },
  { category: "Renovation", name: "Kitchen renovation", default_class: "major", urgent_allowed: false, sort_order: 5 },
];

// Quezon City. Longitude first, then latitude.
const SAMPLE_POINT = "SRID=4326;POINT(121.0437 14.6760)";

function fail(message) {
  console.error(`Seed stopped: ${message}`);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_TEST_PASSWORD;
if (!url || !serviceKey) fail("Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
if (!password || password.length < 8) fail("Add SEED_TEST_PASSWORD (8 or more characters) to .env.local first.");

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

function check(label, error) {
  if (error) fail(`${label}: ${error.message}`);
}

async function ensureUser(user) {
  const created = await supabase.auth.admin.createUser({
    email: user.email,
    password,
    email_confirm: true,
    app_metadata: { role: user.role },
  });
  if (!created.error) return created.data.user.id;

  // Already exists: find it and reset its password and role.
  const list = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  check("list users", list.error);
  const found = list.data.users.find((u) => u.email === user.email);
  if (!found) fail(`create ${user.email}: ${created.error.message}`);
  const updated = await supabase.auth.admin.updateUserById(found.id, {
    password,
    email_confirm: true,
    app_metadata: { role: user.role },
  });
  check(`update ${user.email}`, updated.error);
  return found.id;
}

const ids = {};
for (const user of TEST_USERS) {
  ids[user.key] = await ensureUser(user);
  // The sign up trigger made the profile. Fill in the names and make sure the role is right.
  const { error } = await supabase
    .from("profiles")
    .update({ first_name: user.first, last_name: user.last, role: user.role })
    .eq("id", ids[user.key]);
  check(`profile ${user.email}`, error);
  console.log(`ok  ${user.role.padEnd(8)} ${user.email}`);
}

const services = await supabase.from("services").upsert(SERVICES, { onConflict: "category,name" }).select("id");
check("services", services.error);
console.log(`ok  ${services.data.length} sample services`);

const provider = await supabase.from("provider_profiles").upsert({
  profile_id: ids.provider,
  status: "approved",
  daily_rate: 1500,
  payout_method: "gcash",
  payout_account_name: "Test Provider",
  payout_account_number: "09170000000",
  emergency_contact_name: "Test Contact",
  emergency_contact_phone: "09170000001",
  base_location: SAMPLE_POINT,
});
check("provider profile", provider.error);

const links = await supabase
  .from("provider_services")
  .upsert(services.data.map((s) => ({ provider_id: ids.provider, service_id: s.id })));
check("provider services", links.error);

const existing = await supabase.from("addresses").select("id").eq("profile_id", ids.customer).limit(1);
check("read address", existing.error);
if (existing.data.length === 0) {
  const address = await supabase.from("addresses").insert({
    profile_id: ids.customer,
    label: "Home",
    line1: "Sample street",
    city: "Quezon City",
    province: "Metro Manila",
    landmark: "Sample landmark",
    location: SAMPLE_POINT,
  });
  check("address", address.error);
}
console.log("ok  provider approved, services linked, customer address saved");
console.log("Done. Sign in with any test email above and the password in SEED_TEST_PASSWORD.");
