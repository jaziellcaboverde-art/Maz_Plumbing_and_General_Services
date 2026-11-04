/** Verify the live Next.js endpoint with actual demo sessions. Never prints cookies or passwords. */
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
try { process.loadEnvFile('.env.local'); } catch { /* Environment may already be populated. */ }
const report = JSON.parse(readFileSync('.demo-seed-report.json', 'utf8'));
const env = process.env;
const origin = env.DEMO_APP_URL || 'http://localhost:3000';
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
async function cookieFor(account) {
  const cookies = new Map();
  const client = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false },
    cookies: {
      getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
      setAll: values => values.forEach(({ name, value }) => cookies.set(name, value)),
    },
  });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password: env.SEED_TEST_PASSWORD });
  if (error) throw Error(`Demo login failed: ${error.message}`);
  return [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function request(booking, cookie) {
  return fetch(`${origin}/api/admin/bookings/${booking.bookingId}/ml-recommendations`, {
    headers: cookie ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(90000), redirect: 'manual',
  });
}
const first = report.recommendations[0];
if ((await request(first)).status !== 401) throw Error('Signed-out endpoint should return 401');
console.log('Signed-out access: 401');
for (const role of ['customer', 'provider']) {
  const account = report.accounts.find(a => a.role === role && (!a.status || a.status === 'approved'));
  const cookie = await cookieFor(account);
  if ((await request(first, cookie)).status !== 403) throw Error(`${role} endpoint should return 403`);
  console.log(`${role} access: 403`);
}
const cookie = await cookieFor(report.accounts.find(a => a.role === 'admin'));
for (const booking of report.recommendations) {
  const response = await request(booking, cookie);
  if (!response.ok) throw Error(`Admin endpoint failed: ${response.status} / ${booking.service}`);
  const body = await response.json();
  const { data, error } = await service.rpc('matching_candidates', { p_booking_id: booking.bookingId });
  if (error) throw Error(error.message);
  const eligible = new Set(data.map(candidate => candidate.provider_id));
  const returned = body.top_three.map(candidate => candidate.provider_id);
  if (returned.length !== Math.min(3, eligible.size) || new Set(returned).size !== returned.length || !returned.every(value => eligible.has(value))) throw Error(`Invalid recommendation IDs for ${booking.service}`);
  if (body.eligible_count !== eligible.size) throw Error('Eligible provider counts differ');
  if (booking === first && returned.length) {
    const selected = returned[0];
    const selectionResponse = await fetch(`${origin}/api/admin/bookings/${booking.bookingId}/ml-recommendations?exclude=${selected}`, {
      headers: { Cookie: cookie }, signal: AbortSignal.timeout(90000),
    });
    if (!selectionResponse.ok) throw Error('Selection-aware recommendations failed');
    const selection = await selectionResponse.json();
    if (selection.top_three.some(candidate => candidate.provider_id === selected) || selection.remaining_count !== eligible.size - 1)
      throw Error('Selected worker was not excluded from refreshed recommendations');
    if (!selection.eligible_provider_ids.includes(selected)) throw Error('Selected worker disappeared from the eligible selector');
    console.log('Selection refresh: selected worker excluded; eligible selector preserved.');
  }
  console.log(`${booking.service}: ${body.mode}, ${returned.length} valid recommendations / ${body.eligible_count} eligible`);
}
console.log('Live demo recommendation and role-access checks passed.');
