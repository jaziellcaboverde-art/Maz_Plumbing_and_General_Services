/** Consolidate only seed-owned providers; use existing resignation safeguards and preserve history. */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SEED_TAG } from './demo-fixtures.mjs';
try { process.loadEnvFile('.env.local'); } catch { /* Environment may already be set. */ }
const apply = process.argv.includes('--apply');
const verify = process.argv.includes('--verify');
const target = 56;
const report = JSON.parse(readFileSync('.demo-seed-report.json', 'utf8'));
const env = process.env;
if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Configure Supabase server settings first.');
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (url, init) => fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(30000) }) },
});
function check(result, label) { if (result.error) throw Error(`${label}: ${result.error.message}`); return result.data; }
async function read(table, fields = '*') { return check(await db.from(table).select(fields).range(0, 4999), table); }
const providerRecords = await read('provider_profiles');
const profiles = await read('profiles', 'id,role,first_name,last_name');
const providerRecordIds = new Set(providerRecords.map(p => p.profile_id));
const orphanRoles = profiles.filter(p => p.role === 'provider' && !providerRecordIds.has(p.id));
const services = (await read('services')).filter(s => s.active);
const demo = report.accounts.filter(p => p.key.startsWith('provider-') || p.key.startsWith('applicant-'));
const demoIds = new Set(demo.map(p => p.id));
const approvedDemo = providerRecords.filter(p => p.status === 'approved' && demoIds.has(p.profile_id));
const existing = providerRecords.filter(p => p.status === 'approved' && !demoIds.has(p.profile_id));
const quota = target - existing.length;
if (quota < 0) throw Error(`There are ${existing.length} existing approved providers. Existing accounts will not be removed automatically.`);
const categories = [...new Set(services.map(s => s.category))].sort();
const activeBookings = check(await db.from('bookings').select('id,provider_id,picked_provider_id').not('status', 'in', '(completed,cancelled)').range(0, 4999), 'active bookings');
const assignments = check(await db.from('provider_assignments').select('provider_id').in('status', ['offered', 'accepted', 'withdrawal_requested']).range(0, 4999), 'active teams');
const requiredIds = new Set([...activeBookings.flatMap(b => [b.provider_id, b.picked_provider_id]), ...assignments.map(a => a.provider_id)].filter(Boolean));
const peopleById = new Map(demo.map(p => [p.id, p]));
let retained = approvedDemo.filter(p => requiredIds.has(p.profile_id)).map(p => peopleById.get(p.profile_id));
if (report.providerRoster) retained = report.providerRoster.retainedDemoIds.map(pid => peopleById.get(pid));
if (retained.length > quota || retained.some(p => !p)) throw Error('Active demo assignments exceed the available roster slots. Reassign them before consolidation.');
// Keep category coverage, preferring the original first provider and active scenario workers.
const candidates = approvedDemo.map(p => peopleById.get(p.profile_id));
while (retained.length < quota) {
  const next = candidates.filter(p => !retained.includes(p)).sort((a, b) => {
    const count = p => retained.filter(r => r.category === p.category).length;
    return count(a) - count(b) || a.key.localeCompare(b.key);
  })[0];
  if (!next) throw Error('Not enough approved demo providers to reach 56 without creating accounts.');
  retained.push(next);
}
const retainedIds = new Set(retained.map(p => p.id));
const archived = demo.filter(p => !retainedIds.has(p.id));
for (const person of archived) if (requiredIds.has(person.id)) throw Error(`Cannot retire ${person.key}: it has unfinished work.`);
const skillsFor = person => {
  const start = categories.indexOf(person.category);
  return Array.from({ length: Math.min(5, categories.length) }, (_, offset) => categories[(start + offset) % categories.length]);
};
console.log(`Approved providers: ${existing.length + approvedDemo.length}. Target: ${target} (${existing.length} existing + ${retained.length} retained demo).`);
console.log(`Archive ${archived.length} excess demo/application accounts. Retained demo providers receive five specializations each.`);
if (!apply && !verify) { console.log('Read-only plan. Pass --apply to consolidate or --verify to check the completed roster.'); process.exit(0); }
const admin = report.accounts.find(p => p.role === 'admin');
if (!admin) throw Error('Missing demo administrator.');

if (apply) {
  const authById = new Map();
  // Validate every target's ownership before any write. Never retire an unrelated account.
  for (const person of demo) {
    const authUser = check(await db.auth.admin.getUserById(person.id), 'check demo ownership').user;
    if (authUser.app_metadata?.demo_seed !== SEED_TAG || authUser.email !== person.email) throw Error(`Not a seed-owned account: ${person.key}`);
    authById.set(person.id, authUser);
  }
  const backupPath = '.demo-provider-roster-backup.json';
  if (!existsSync(backupPath)) {
    const snapshot = { generatedAt: new Date().toISOString(), report, tables: {} };
    for (const table of ['provider_profiles', 'provider_services', 'provider_documents', 'provider_service_claims', 'provider_weekly_hours']) {
      const rows = await read(table);
      snapshot.tables[table] = rows.filter(row => demoIds.has(row.profile_id ?? row.provider_id));
    }
    writeFileSync(backupPath, JSON.stringify(snapshot, null, 2) + '\n');
  }
  for (const orphan of orphanRoles) {
    const current = check(await db.from('provider_profiles').select('profile_id').eq('profile_id', orphan.id).maybeSingle(), 'recheck orphan role');
    if (current) throw Error('A provider application changed during reconciliation. Rerun to recheck it.');
    const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
    backup.orphanRoleCorrections ??= [];
    if (!backup.orphanRoleCorrections.some(p => p.id === orphan.id)) backup.orphanRoleCorrections.push({ id: orphan.id, previousRole: 'provider' });
    writeFileSync(backupPath, JSON.stringify(backup, null, 2) + '\n');
    check(await db.from('profiles').update({ role: 'customer' }).eq('id', orphan.id).eq('role', 'provider'), 'correct provider role without application');
    check(await db.rpc('write_audit', { p_actor: admin.id, p_action: 'provider.orphan_role_corrected', p_target_table: 'profiles', p_target_id: orphan.id,
      p_reason: 'Provider role without provider profile; customer access until an application is approved', p_details: { previous_role: 'provider', role: 'customer' } }), 'audit orphan role correction');
  }
  // Add the new many-to-many skill links before retiring the excess roster.
  for (const person of retained) {
    const categoriesForPerson = skillsFor(person);
    const approvedServices = services.filter(s => categoriesForPerson.includes(s.category));
    check(await db.from('provider_services').upsert(approvedServices.map(s => ({ provider_id: person.id, service_id: s.id })), { onConflict: 'provider_id,service_id', ignoreDuplicates: true }), 'multi-specialization links');
    check(await db.from('provider_service_claims').upsert(approvedServices.map(s => ({
      provider_id: person.id, service_id: s.id, proof_paths: [`${person.id}/${SEED_TAG}.png`],
      status: 'approved', decided_by: admin.id, decided_at: new Date().toISOString(),
      note: 'DEMO ONLY: synthetic multi-specialization fixture, not an actual qualification verification.',
    })), { onConflict: 'provider_id,service_id' }), 'demo skill approvals');
  }
  let completed = 0;
  for (const person of archived) {
    const record = providerRecords.find(p => p.profile_id === person.id);
    const profile = profiles.find(p => p.id === person.id);
    if (record && profile?.role === 'provider') {
      check(await db.rpc('admin_remove_provider_details', { p_actor: admin.id, p_provider: person.id }), `retire ${person.key}`);
    } else if (record) {
      // Pending/rejected demo applications have customer roles and no provider activity.
      check(await db.from('provider_services').delete().eq('provider_id', person.id), 'remove archived skills');
      check(await db.from('provider_documents').delete().eq('provider_id', person.id), 'remove archived documents');
      check(await db.from('provider_profiles').delete().eq('profile_id', person.id), 'archive application');
    }
    const authUser = authById.get(person.id);
    if (!authUser.app_metadata?.demo_seed_archived || record) check(await db.auth.admin.updateUserById(person.id, {
        app_metadata: { ...authUser.app_metadata, role: 'customer', demo_seed_archived: true },
        ban_duration: '876000h',
      }), 'disable archived demo login');
    if (++completed % 10 === 0 || completed === archived.length) console.log(`Archived demo accounts: ${completed}/${archived.length}`);
  }
  report.providerRoster = { target, existingApproved: existing.length, retainedDemoIds: [...retainedIds], archivedDemoIds: archived.map(p => p.id), consolidatedAt: new Date().toISOString() };
  for (const person of report.accounts) {
    if (retainedIds.has(person.id)) person.specializations = skillsFor(person);
    if (archived.some(p => p.id === person.id)) { person.role = 'customer'; person.status = 'archived'; person.archived = true; }
  }
  writeFileSync('.demo-seed-report.json', JSON.stringify(report, null, 2) + '\n');
}

const current = await read('provider_profiles');
const currentProfiles = await read('profiles', 'id,role,first_name,last_name');
const currentLinks = await read('provider_services');
const active = current.filter(p => p.status === 'approved');
if (active.length !== target) throw Error(`Expected exactly ${target} approved providers, found ${active.length}.`);
if (currentProfiles.filter(p => p.role === 'provider').length !== target) throw Error('Provider-role count does not equal 56.');
for (const person of archived) if (current.some(p => p.profile_id === person.id)) throw Error(`Archived provider details still exist: ${person.key}`);
for (const person of retained) {
  const assigned = new Set(currentLinks.filter(l => l.provider_id === person.id).map(l => services.find(s => s.id === l.service_id)?.category).filter(Boolean));
  if (assigned.size < Math.min(5, categories.length)) throw Error(`Missing specializations: ${person.key}`);
}
for (const booking of report.recommendations) {
  const matches = check(await db.rpc('matching_candidates', { p_booking_id: booking.bookingId }), `matching ${booking.service}`);
  if (matches.length < 3 || matches.some(p => archived.some(a => a.id === p.provider_id))) throw Error(`Incomplete or archived matches for ${booking.service}`);
  console.log(`${booking.service}: ${matches.length} eligible unique providers`);
}
if (apply) {
  const serviceCategories = new Map(services.map(s => [s.id, s.category]));
  const lines = ['# Active provider roster', '', '**Exactly 56 approved providers.** Existing providers were preserved. Excess demo provider identities are archived and cannot sign in; their historical booking/payment records remain unchanged.', '',
    '| Full name | Account | Specializations |', '|---|---|---|',
    ...active.map(p => {
      const name = currentProfiles.find(person => person.id === p.profile_id);
      const account = report.accounts.find(person => person.id === p.profile_id);
      const categoriesForPerson = [...new Set(currentLinks.filter(l => l.provider_id === p.profile_id).map(l => serviceCategories.get(l.service_id)).filter(Boolean))];
      return `| ${name?.first_name ?? ''} ${name?.last_name ?? ''} | ${account?.email ?? 'Existing account (unchanged)'} | ${categoriesForPerson.join(', ')} |`;
    }), '', 'Demo account passwords remain in SEED_TEST_PASSWORD in .env.local. The existing rejected applicant is retained as an application record, not an active provider.', ''];
  writeFileSync('docs/ACTIVE_PROVIDER_ROSTER.md', lines.join('\n'));
  let directory = readFileSync('docs/DEMO_TEST_DATA.md', 'utf8');
  const notice = '> **Roster corrected:** use [the 56-provider roster](ACTIVE_PROVIDER_ROSTER.md). Archived demo accounts listed in the original seed directory below are disabled. Only retained demo providers and existing providers are active.\n\n';
  if (!directory.includes('**Roster corrected:**')) directory = directory.replace('# Fictional workflow demo data\n\n', '# Fictional workflow demo data\n\n' + notice);
  writeFileSync('docs/DEMO_TEST_DATA.md', directory);
}
console.log('Verified: exactly 56 active provider accounts; multi-specialization links valid; archived accounts excluded from recommendations.');
