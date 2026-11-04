/** Additive fictional fixtures. No gateway, email, SMS, or real payout APIs are called. */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import { buildPeople, fixtureId as id, phone, point, samplePng, SEED_TAG, STAGES, PREFIX } from './demo-fixtures.mjs';

try { process.loadEnvFile('.env.local'); } catch { /* CI may supply environment variables. */ }
const apply = process.argv.includes('--apply');
const verifyOnly = process.argv.includes('--verify');
if (apply) throw Error('The per-category 110-provider seed is retired. Use npm run seed:demo -- --apply to maintain the 56-provider multi-specialization roster.');
const env = process.env;
for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!env[key]) throw Error(`Missing ${key} in .env.local`);
}
if ((apply || verifyOnly) && (!env.SEED_TEST_PASSWORD || env.SEED_TEST_PASSWORD.length < 8)) throw Error('Set SEED_TEST_PASSWORD to at least 8 characters in .env.local.');
const options = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(30000) }) } };
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
function checked(result, label) {
  if (result.error) throw Error(`${label}: ${result.error.message}`);
  return result.data;
}
async function rows(table, values, conflict = 'id') {
  if (!values.length) return;
  // DO NOTHING preserves existing fixtures, including immutable approved records.
  checked(await db.from(table).upsert(values, { onConflict: conflict, ignoreDuplicates: true }), table);
}
async function pool(items, fn, size = 5) {
  let next = 0, failure;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (!failure && next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
}
const services = checked(await db.from('services').select('id,name,category,default_class,urgent_allowed,inspection_policy').eq('active', true).order('sort_order'), 'catalog');
if (!services.length) throw Error('No active services. Apply the normal catalog migrations first.');
const people = buildPeople(services);
const providers = people.filter(p => p.status === 'approved');
const customers = people.filter(p => p.key.startsWith('customer-'));
const admin = people[0];
const categories = [...new Set(providers.map(p => p.category))];
console.log(`Plan: ${categories.length} categories × 10 = ${providers.length} approved providers; ${customers.length} customers; 1 admin; 3 application/status cases.`);
console.log(`Includes ${services.length} recommendation bookings, ${STAGES.length} workflow scenarios, and ${providers.reduce((n, p) => n + 3 + p.slot % 3, 0)} completed history bookings.`);
if (!apply && !verifyOnly) {
  console.log('Read-only plan. Use --apply to add fixtures, or --verify to validate an existing seed.');
  process.exit(0);
}

// Check prerequisites before creating accounts. Never change production catalog/configuration.
for (const [table, columns] of Object.entries({
  profiles: 'id,first_name,birthday,mobile', bookings: 'id,source_channel,execution_confirmed_at,official_status',
  provider_profiles: 'profile_id,years_experience,reference_1_name', provider_assignments: 'id,phase,status',
  provider_work_updates: 'id,review_status,idempotency_key', quotes: 'id,version,line_items',
  payments: 'id,purpose,manual_channel', project_documents: 'id', provider_service_claims: 'provider_id',
  booking_turnovers: 'booking_id', company_reviews: 'id', manual_payment_claims: 'id',
})) checked(await db.from(table).select(columns).limit(0), `schema ${table}`);
const users = [];
for (let page = 1; ; page++) {
  const data = checked(await db.auth.admin.listUsers({ page, perPage: 1000 }), 'list users');
  users.push(...data.users);
  if (data.users.length < 1000) break;
}
const existingUsers = new Map(users.map(u => [u.email?.toLowerCase(), u]));
const png = samplePng();
async function upload(bucket, path) {
  const result = await db.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: false });
  if (result.error && !['409', 'Duplicate'].includes(String(result.error.statusCode)) && !/already exists/i.test(result.error.message)) throw Error(`upload ${bucket}: ${result.error.message}`);
  return path;
}
const day = (offset, hour = 9) => {
  const d = new Date();
  // Fixed +08:00 business dates; do not depend on the host's timezone.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const base = new Date(`${today}T00:00:00+08:00`);
  return new Date(base.getTime() + offset * 86400000 + hour * 3600000).toISOString();
};
async function signIn(person) {
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  checked(await client.auth.signInWithPassword({ email: person.email, password: env.SEED_TEST_PASSWORD }), `login ${person.key}`);
  return client;
}

if (apply) {
  let complete = 0;
  await pool(people, async person => {
    const existing = existingUsers.get(person.email);
    if (existing && existing.app_metadata?.demo_seed !== SEED_TAG) throw Error(`Reserved demo email collision: ${person.email}. Existing account was not changed.`);
    const user = existing ?? checked(await db.auth.admin.createUser({
      email: person.email, password: env.SEED_TEST_PASSWORD, email_confirm: true,
      app_metadata: { role: person.role, demo_seed: SEED_TAG },
      user_metadata: { first_name: person.first, last_name: person.last, demo_seed: SEED_TAG },
    }), `create ${person.key}`).user;
    person.id = user.id;
    const existingProfile = checked(await db.from('profiles').select('first_name,birthday').eq('id', user.id).single(), 'profile');
    if (!existingProfile.birthday) checked(await db.from('profiles').update({
      first_name: person.first, last_name: person.last, role: person.role,
      birthday: `${1975 + person.index % 25}-05-15`, mobile: phone(person.index),
      account_type: person.key === 'customer-12' ? 'business' : 'household',
      business_name: person.key === 'customer-12' ? 'Demo Only Sample Property Services' : null,
    }).eq('id', user.id), 'fill demo profile');
    await rows('user_settings', [{ profile_id: user.id, font_size: 'medium', notification_prefs: {} }], 'profile_id');
    await rows('addresses', [{
      id: id(`${person.key}:address`), profile_id: user.id, label: 'Demo home — fictional',
      line1: `${10 + person.index} Sample Lane (fictional test address)`, barangay: 'Central',
      city: 'Quezon City', province: 'Metro Manila', landmark: 'DEMO ONLY — do not dispatch',
      location: person.status ? point(person.index) : 'SRID=4326;POINT(121.0437 14.6760)',
    }]);
    if (person.status) {
      const path = `${user.id}/${SEED_TAG}.png`;
      await Promise.all([upload('ids', path), upload('selfies', path)]);
      await rows('provider_profiles', [{
        profile_id: user.id, status: person.status, daily_rate: 1200 + (person.slot ?? 0) * 175,
        payout_method: 'gcash', payout_account_name: `${person.first} ${person.last}`, payout_account_number: phone(person.index).replace('+63', '0'),
        emergency_contact_name: `${person.first.split(' ')[0]} Demo Emergency Contact`, emergency_contact_phone: phone(person.index + 2000),
        base_location: point(person.index), base_address: `${10 + person.index} Sample Lane, Central, Quezon City (fictional)`,
        service_area: 'Quezon City and nearby Metro Manila — demo only', years_experience: 3 + (person.slot ?? 0),
        reference_1_name: 'Roberto Mateo Demo Reference', reference_1_phone: phone(person.index + 3000),
        reference_2_name: 'Elena Cristina Demo Reference', reference_2_phone: phone(person.index + 4000),
        document_consent_at: day(-90), application_note: `${PREFIX} Fictional ${person.category} provider; attachments are marked SAMPLE ONLY.`,
        reviewed_by: null, reviewed_at: person.status === 'pending' ? null : day(-80),
        rejection_reason: person.status === 'rejected' ? 'Demo rejection: application needs a replacement sample attachment.' : null,
        interview_done_at: day(-80), interview_notes: 'DEMO ONLY: simulated skills interview, no actual credential verification.',
      }], 'profile_id');
      await rows('provider_documents', ['government_id', 'selfie', 'nbi_clearance', 'proof_of_address', 'skill_certificate', 'resume', 'medical_certificate'].map(kind => ({ id: id(`${person.key}:document:${kind}`), provider_id: user.id, kind, storage_path: path })));
      const skills = services.filter(s => s.category === person.category);
      await rows('provider_service_claims', skills.map(s => ({ provider_id: user.id, service_id: s.id, proof_paths: [path], status: person.status === 'approved' ? 'approved' : person.status === 'rejected' ? 'rejected' : 'pending', note: 'DEMO ONLY: synthetic service proof', decided_at: person.status === 'approved' ? day(-80) : null })), 'provider_id,service_id');
      if (person.status === 'approved') await rows('provider_services', skills.map(s => ({ provider_id: user.id, service_id: s.id })), 'provider_id,service_id');
      await rows('provider_weekly_hours', Array.from({ length: 7 }, (_, weekday) => ({ provider_id: user.id, weekday, starts_at: '07:00', ends_at: '19:00' })), 'provider_id,weekday');
    }
    if (++complete % 10 === 0 || complete === people.length) console.log(`Accounts/profiles ready: ${complete}/${people.length}`);
  });
} else {
  for (const person of people) {
    const user = existingUsers.get(person.email);
    if (!user || user.app_metadata?.demo_seed !== SEED_TAG) throw Error(`Missing seeded account ${person.email}`);
    person.id = user.id;
  }
}
const adminClient = await signIn(admin);
if (apply) checked(await db.from('provider_profiles').update({ reviewed_by: admin.id })
  .in('profile_id', people.filter(p => p.status && p.status !== 'pending').map(p => p.id)).is('reviewed_by', null), 'demo application reviewer');
// Avoid auth rate limits: only the customer who owns each demo scenario signs in.
const customerClients = new Map();
for (const customer of customers) customerClients.set(customer.id, await signIn(customer));
const report = { seed: SEED_TAG, generatedAt: new Date().toISOString(), fictional: true,
  accounts: people.map(({ key, id, email, role, first, last, category, status }) => ({ key, id, email, role, name: `${first} ${last}`, category, status })),
  categories: categories.map(category => ({ category, approvedProviders: 10 })), recommendations: [], scenarios: [] };

const makeSpec = (key, service, customer, provider, stage, offset, slot = 0, history = false) => ({ key, service, customer, provider, stage, offset, slot, history });
const histories = providers.flatMap(provider => Array.from({ length: 3 + provider.slot % 3 }, (_, j) => makeSpec(
  `history:${provider.key}:${j}`, services.find(s => s.category === provider.category), customers[(provider.index + j) % customers.length], provider, 'completed', -14 - j * 8 - provider.slot, j, true,
)));
const recommendations = services.map((service, index) => makeSpec(`recommend:${service.id}`, service, customers[index % customers.length], null, 'recommendation', 10 + index));
const scenarios = STAGES.map((stage, index) => {
  const service = services[index % services.length];
  return makeSpec(`scenario:${stage}`, service, customers[index % customers.length], providers.find(p => p.category === service.category && p.slot === 9), stage, 35 + index, index);
});
const pathStates = ['draft', 'open', 'accepted', 'quoted', 'deposit_paid', 'scheduled', 'in_progress', 'done', 'signed', 'balance_paid', 'completed'];
function finalState(stage) {
  return ({ draft: 'draft', recommendation: 'open', inspection: 'accepted', offered: 'accepted', quote: 'quoted',
    'payment-pending': 'quoted', 'payment-rejected': 'quoted', 'payment-failed': 'quoted', 'deposit-paid': 'deposit_paid', scheduled: 'scheduled',
    'in-progress': 'in_progress', 'completion-review': 'in_progress', turnover: 'done', 'balance-due': 'signed', completed: 'completed',
    refund: 'cancelled', cancelled: 'cancelled', dispute: 'in_progress', 'change-order': 'in_progress', milestone: 'in_progress' })[stage];
}
async function seedBooking(spec) {
  const { key, service, customer, provider, stage, history, slot } = spec;
  const bookingId = id(key), quoteId = id(`${key}:quote`);
  const target = finalState(stage);
  const targetIndex = pathStates.indexOf(target);
  const isMajor = service.default_class === 'major';
  const total = isMajor ? 120000 : 6000 + slot * 250;
  const deposit = total / 2; // Standard/large demo quotes use the configured 50% tier.
  const start = day(spec.offset), end = day(spec.offset, 13);
  const before = day(spec.offset - 5), paidAt = day(spec.offset - 2);
  await rows('bookings', [{ id: bookingId, customer_id: customer.id, service_id: service.id,
    address_id: id(`${customer.key}:address`), description: `${PREFIX} ${history ? 'Synthetic history' : stage.toUpperCase()} — ${service.name}. Fictional test booking; do not dispatch or collect money.`,
    status: 'draft', source_channel: 'demo_seed', created_by: admin.id, created_at: before,
    preferred_start: start, alternate_start: day(spec.offset + 1), is_urgent: false,
    job_class: isMajor ? 'major' : 'minor', is_major_renovation: isMajor, payment_tier: isMajor ? 'large' : 'standard',
    provider_id: targetIndex >= 2 || target === 'cancelled' && stage === 'refund' ? provider?.id : null,
    terms_accepted_at: before, providers_alerted_at: before, reminder_day_sent_at: before, reminder_two_hour_sent_at: before,
    needs_admin: target === 'open', needs_admin_reason: target === 'open' ? 'DEMO: compare eligible provider recommendations.' : null,
    admin_accepted_at: targetIndex >= 2 ? before : null,
    admin_review_note: 'DEMO ONLY: synthetic workflow fixture', inspection_required: stage === 'inspection', inspection_fee: 0,
    inspection_pay_before_visit: false, contract_required: isMajor && targetIndex >= 3,
    scheduled_start: targetIndex >= 2 ? start : null, schedule_confirmed_at: targetIndex >= 2 ? before : null,
    execution_confirmed_at: targetIndex >= 5 ? before : null,
    site_inspected_at: targetIndex >= 3 ? before : null,
    quote_total: targetIndex >= 3 || stage === 'refund' ? total : null,
    deposit_amount: targetIndex >= 3 || stage === 'refund' ? deposit : null,
  }]);
  let current = checked(await db.from('bookings').select('status,source_channel').eq('id', bookingId).single(), key);
  if (current.source_channel !== 'demo_seed') throw Error('Fixture ID collision; no existing booking changed.');
  const proof = `${bookingId}/${provider?.id ?? customer.id}/${SEED_TAG}.png`;
  if (!history) await upload('booking-photos', `${bookingId}/${SEED_TAG}.png`);
  if (provider && targetIndex >= 2) {
    const status = stage === 'offered' ? 'offered' : targetIndex >= 7 ? 'completed' : 'accepted';
    await rows('provider_assignments', [{ id: id(`${key}:assignment`), booking_id: bookingId, provider_id: provider.id, assigned_by: admin.id,
      trade: service.category, phase: stage === 'inspection' ? 'inspection' : 'execution', starts_at: start, ends_at: end, travel_minutes: 30,
      expires_at: day(history ? spec.offset : 30), status, responded_at: status === 'offered' ? null : before,
      response_note: 'DEMO ONLY: sample team response', created_at: before }]);
    await rows('offers', [{ id: id(`${key}:offer`), booking_id: bookingId, provider_id: provider.id, kind: 'admin_assign', status: 'accepted', expires_at: before, responded_at: before, created_at: before }]);
  }
  if (targetIndex >= 3 || stage === 'refund') {
    const quoteStatus = stage === 'quote' ? 'approved' : 'accepted';
    await rows('quotes', [{ id: quoteId, booking_id: bookingId, proposed_by: admin.id, approved_by: admin.id,
      amount: total, deposit_amount: deposit, job_class: isMajor ? 'major' : 'minor', payment_tier: isMajor ? 'large' : 'standard', status: quoteStatus,
      version: 1, created_at: before, expires_at: day(80), notes: 'DEMO ONLY: sample scope and simulated prices.',
      line_items: [{ description: 'Demo labor and materials', quantity: 1, unitPrice: total }],
      payment_schedule: [{ label: 'Deposit', amount: deposit }, { label: 'Balance after turnover', amount: deposit }],
      accepted_by: quoteStatus === 'accepted' ? customer.id : null, accepted_at: quoteStatus === 'accepted' ? before : null,
    }]);
    if (isMajor) await rows('project_documents', [{ id: id(`${key}:contract`), booking_id: bookingId, quote_id: quoteId, kind: 'contract', version: 1,
      title: 'DEMO ONLY — sample work contract', body: 'FICTIONAL TEST DOCUMENT. This sample scope covers demo labor, materials, testing and turnover. It creates no agreement or payment obligation.',
      status: quoteStatus === 'accepted' ? 'accepted' : 'issued', issued_by: admin.id,
      accepted_by: quoteStatus === 'accepted' ? customer.id : null, decided_at: quoteStatus === 'accepted' ? before : null }]);
  }
  async function payment(kind, amount, state = 'paid') {
    const paymentId = id(`${key}:payment:${kind}:${state}`);
    const channel = ['gcash', 'cash', 'bank'][slot % 3];
    await rows('payments', [{ id: paymentId, booking_id: bookingId, kind, purpose: kind, amount, status: state,
      method: channel === 'bank' ? null : channel, manual_channel: channel, paid_at: state === 'paid' ? paidAt : null, created_at: paidAt,
      failure_reason: state === 'failed' ? 'DEMO: simulated payment failure; no gateway was contacted.' : null,
      refunded_amount: 0,
    }]);
    if (state === 'paid') {
      const receiptProof = `${bookingId}/${customer.id}/${SEED_TAG}-payment.png`;
      await upload('receipts', receiptProof);
      await rows('manual_payment_claims', [{ id: id(`${key}:claim:${kind}`), booking_id: bookingId, customer_id: customer.id, purpose: kind,
        amount, method: channel, reference: `DEMO-${bookingId}-${kind}`, proof_path: receiptProof, status: 'verified',
        payment_id: paymentId, decision_note: 'SIMULATED verification for testing only — no money transferred.', verified_by: admin.id, request_key: id(`${key}:claim-key:${kind}`), created_at: paidAt }]);
      await rows('payment_events', [{ id: id(`${key}:event:${kind}`), booking_id: bookingId, payment_id: paymentId, kind: 'demo_simulated_payment', amount, reference: `DEMO-${kind}`, actor_id: admin.id, created_at: paidAt }]);
      await rows('receipts', [{ id: id(`${key}:receipt:${kind}`), number: `DEMO-${bookingId}-${kind}`, booking_id: bookingId, payment_id: paymentId, kind, amount, pdf_path: null, issued_at: paidAt }]);
    }
    return paymentId;
  }
  if (targetIndex >= 4 || stage === 'refund') await payment('deposit', deposit);
  if (targetIndex >= 9) await payment('balance', deposit);
  if (stage === 'payment-failed') await payment('deposit', deposit, 'failed');
  if (stage === 'payment-pending' || stage === 'payment-rejected') {
    const receiptProof = `${bookingId}/${customer.id}/${SEED_TAG}-claim.png`;
    await upload('receipts', receiptProof);
    await rows('manual_payment_claims', [{ id: id(`${key}:pending-claim`), booking_id: bookingId, customer_id: customer.id, purpose: 'deposit', amount: deposit,
      method: 'gcash', reference: `DEMO-PENDING-${bookingId}`, proof_path: receiptProof,
      status: stage === 'payment-rejected' ? 'rejected' : 'pending', decision_note: stage === 'payment-rejected' ? 'DEMO: sample amount/reference could not be verified.' : null,
      verified_by: stage === 'payment-rejected' ? admin.id : null, request_key: id(`${key}:pending-key`) }]);
  }
  if (targetIndex >= 6) {
    await upload('proof-photos', proof);
    await rows('work_days', [{ id: id(`${key}:work-day`), booking_id: bookingId, provider_id: provider.id, work_date: start.slice(0, 10),
      arrived_at: new Date(Date.parse(start) + (slot % 3 === 0 ? 20 : -5) * 60000).toISOString(), arrival_location: 'SRID=4326;POINT(121.0437 14.6760)',
      arrival_distance_m: 12, gps_accuracy_m: 8, closed_at: targetIndex >= 7 ? end : null, close_note: targetIndex >= 7 ? 'DEMO ONLY: synthetic workday completion.' : null,
      close_photo_paths: targetIndex >= 7 ? [proof] : [] }]);
    await rows('provider_work_updates', [{ id: id(`${key}:work-update`), booking_id: bookingId, provider_id: provider.id,
      kind: targetIndex >= 7 || stage === 'completion-review' ? 'completion' : 'progress', notes: 'DEMO ONLY: sample work evidence for testing the admin review process.',
      photo_paths: [proof], review_status: targetIndex >= 7 ? 'approved' : 'pending', reviewed_by: targetIndex >= 7 ? admin.id : null,
      review_note: targetIndex >= 7 ? 'DEMO ONLY: simulated evidence approval.' : null, reviewed_at: targetIndex >= 7 ? end : null, idempotency_key: id(`${key}:update-key`), created_at: start }]);
    await rows('materials', [{ id: id(`${key}:materials`), booking_id: bookingId, provider_id: provider.id, amount: 1000,
      approved: true, approved_by: admin.id, created_at: start }]);
  }
  if (targetIndex >= 8) {
    await rows('booking_turnovers', [{ booking_id: bookingId, customer_id: customer.id, notes: 'DEMO ONLY: fictional customer acknowledgment. No actual service was performed.', acknowledged_at: end }], 'booking_id');
    await upload('signatures', `${bookingId}/${SEED_TAG}.png`);
    await rows('signatures', [{ id: id(`${key}:signature`), booking_id: bookingId, signer_id: customer.id, image_path: `${bookingId}/${SEED_TAG}.png`, signed_at: end, device: 'DEMO FIXTURE — SAMPLE ONLY, NOT AN ACTUAL SIGNATURE' }]);
  }
  // Existing status guards remain enabled. Replay only legal transitions, and resume partial runs.
  if (current.status !== target) {
    if (current.status === 'draft' && target !== 'draft') {
      checked(await customerClients.get(customer.id).rpc('change_booking_status', { p_booking_id: bookingId, p_to: 'open', p_reason: 'DEMO ONLY: seed workflow' }), `submit ${key}`);
      current.status = 'open';
    }
    if (target === 'cancelled') {
      checked(await adminClient.rpc('change_booking_status', { p_booking_id: bookingId, p_to: 'cancelled', p_reason: 'DEMO ONLY: simulated cancellation' }), `cancel ${key}`);
    } else {
      for (let step = pathStates.indexOf(current.status) + 1; step <= targetIndex; step++) {
        checked(await adminClient.rpc('change_booking_status', { p_booking_id: bookingId, p_to: pathStates[step], p_reason: 'DEMO ONLY: synthetic workflow fixture' }), `${key} -> ${pathStates[step]}`);
      }
    }
  }
  if (target === 'completed') {
    const stars = 3 + (provider.index + slot) % 3;
    await rows('reviews', [{ id: id(`${key}:review`), booking_id: bookingId, customer_id: customer.id, provider_id: provider.id, stars,
      comment: 'DEMO ONLY: synthetic rating used to test recommendations; not a real customer review.', created_at: end }]);
    if (!history) {
      await rows('provider_feedback', [{ id: id(`${key}:feedback`), booking_id: bookingId, provider_id: provider.id, customer_id: customer.id, stars, comment: 'DEMO ONLY: private sample feedback.' }]);
      await rows('company_reviews', [{ id: id(`${key}:company-review`), booking_id: bookingId, customer_id: customer.id, stars: 5, comment: 'DEMO ONLY: sample company review. Do not publish.', publish: false, attribution: 'no_quote' }]);
      await rows('project_publication_consents', [{ booking_id: bookingId, customer_id: customer.id, photos_allowed: false }], 'booking_id');
    }
    await rows('payouts', [{ id: id(`${key}:payout`), booking_id: bookingId, provider_id: provider.id, amount: total * .6, method: 'gcash', status: history ? 'paid' : 'pending', reference: `DEMO-NO-TRANSFER-${bookingId}`, paid_at: history ? end : null }]);
    await rows('payout_slips', [{ id: id(`${key}:payout-slip`), payout_id: id(`${key}:payout`), marked_paid_by: history ? admin.id : null }]);
  }
  if (!history) {
    await rows('messages', [{ id: id(`${key}:message`), booking_id: bookingId, sender_id: customer.id, body: `${PREFIX} Sample customer question about ${service.name}. No real work or payment is requested.` },
      { id: id(`${key}:reply`), booking_id: bookingId, sender_id: admin.id, body: `${PREFIX} Sample MAZ reply: this booking is available for workflow testing.` }]);
    await rows('notifications', [{ id: id(`${key}:notice`), profile_id: customer.id, event: 'demo.workflow', title: 'Demo booking available', body: `${PREFIX} ${stage}: ${service.name}`, link: `/customer/bookings/${bookingId}` }]);
    const entry = { stage, service: service.name, category: service.category, bookingId, status: target, customer: customer.email, provider: provider?.email, adminUrl: `/admin/bookings/${bookingId}` };
    (key.startsWith('recommend:') ? report.recommendations : report.scenarios).push(entry);
  }
  if (['refund', 'dispute', 'change-order', 'cancelled'].includes(stage)) {
    await rows('booking_requests', [{ id: id(`${key}:request`), booking_id: bookingId, author_id: customer.id,
      kind: stage === 'change-order' ? 'change' : stage === 'cancelled' ? 'cancellation' : stage,
      note: `${PREFIX} Fictional ${stage} request for workflow testing.`, status: stage === 'refund' ? 'settled' : stage === 'cancelled' ? 'approved' : 'requested',
      payment_id: stage === 'refund' ? id(`${key}:payment:deposit:paid`) : null, amount: stage === 'refund' ? deposit : null,
      decision_note: stage === 'refund' ? 'DEMO ONLY: simulated refund; no transfer occurred.' : null,
      decided_by: stage === 'refund' || stage === 'cancelled' ? admin.id : null, decided_at: stage === 'refund' || stage === 'cancelled' ? day(-1) : null,
      reference: stage === 'refund' ? `DEMO-REFUND-${bookingId}` : null, request_key: id(`${key}:request-key`) }]);
    if (target === 'cancelled') await rows('cancellations', [{ id: id(`${key}:cancellation`), booking_id: bookingId, cancelled_by: admin.id, cancelled_by_role: 'admin', reason: 'DEMO ONLY: sample cancellation', fee_basis: 'none', fee_amount: 0 }]);
    if (stage === 'refund') {
      checked(await db.from('payments').update({ status: 'refunded', refunded_amount: deposit })
        .eq('id', id(`${key}:payment:deposit:paid`)).eq('status', 'paid').eq('refunded_amount', 0), 'demo refund');
      await rows('payment_events', [{ id: id(`${key}:refund-event`), booking_id: bookingId, payment_id: id(`${key}:payment:deposit:paid`), kind: 'demo_simulated_refund', amount: -deposit, reference: `DEMO-REFUND-${bookingId}`, actor_id: admin.id }]);
    }
  }
  if (stage === 'milestone' || stage === 'change-order') {
    await rows('milestones', [{ id: id(`${key}:milestone`), booking_id: bookingId, position: 1, title: 'DEMO: first work phase', amount: total * .4, status: 'submitted', submitted_at: day(-1) }]);
    await rows('project_payment_installments', [{ id: id(`${key}:installment`), booking_id: bookingId, quote_id: quoteId, label: 'DEMO milestone installment', amount: total * .4, milestone_id: id(`${key}:milestone`) }]);
    if (stage === 'change-order') await rows('project_documents', [{ id: id(`${key}:change-order`), booking_id: bookingId, quote_id: quoteId, kind: 'change_order', version: 1,
      title: 'DEMO: proposed scope change', body: 'FICTIONAL TEST DOCUMENT: add one sample work item, subject to customer approval.', cost_delta: 1500, days_delta: 1, status: 'issued', issued_by: admin.id }]);
  }
}

if (apply) {
  // Existing legal versions only: record fictional consent without publishing new policies.
  const legal = checked(await db.from('legal_versions').select('id,doc_type,published_at').not('published_at', 'is', null).order('published_at', { ascending: false }), 'legal versions');
  const versions = ['terms', 'privacy'].map(type => legal.find(v => v.doc_type === type)).filter(Boolean);
  await rows('consents', people.flatMap(person => versions.map(v => ({ id: id(`${person.key}:consent:${v.id}`), profile_id: person.id, legal_version_id: v.id, device: 'DEMO FIXTURE: fictional consent record' }))));
  let finished = 0;
  await pool(histories, async spec => {
    await seedBooking(spec);
    if (++finished % 20 === 0 || finished === histories.length) console.log(`Completed histories: ${finished}/${histories.length}`);
  }, 6);
  for (const spec of [...recommendations, ...scenarios]) { await seedBooking(spec); console.log(`Scenario ready: ${spec.stage} / ${spec.service.name}`); }
  for (const customer of customers) {
    await rows('support_threads', [{ id: id(`${customer.key}:support`), customer_id: customer.id, context: 'DEMO ONLY: sample support conversation.' }]);
    await rows('messages', [{ id: id(`${customer.key}:support-message`), support_thread_id: id(`${customer.key}:support`), sender_id: customer.id, body: 'DEMO ONLY: please help me understand the sample booking workflow.' }]);
  }
}

// Read actual matching results, rather than fabricating model features.
for (const spec of recommendations) {
  const matches = checked(await db.rpc('matching_candidates', { p_booking_id: id(spec.key) }), `matching ${spec.service.name}`);
  const expected = providers.filter(p => p.category === spec.service.category);
  const actual = new Map(matches.map(m => [m.provider_id, m]));
  for (const p of expected) {
    const candidate = actual.get(p.id);
    if (!candidate || Number(candidate.finished_jobs) < 3 || !Number.isFinite(Number(candidate.distance_m)) || Number(candidate.review_count) < 3) throw Error(`Incomplete matching data for ${p.key} / ${spec.service.name}`);
  }
  console.log(`Verified ${spec.service.name}: ${matches.length} eligible; all 10 demo providers have location, history and ratings.`);
}
if (verifyOnly) {
  const specs = [...histories, ...recommendations, ...scenarios];
  for (let offset = 0; offset < specs.length; offset += 50) {
    const batch = specs.slice(offset, offset + 50);
    const bookingIds = batch.map(spec => id(spec.key));
    const bookings = checked(await db.from('bookings').select('id,status,quote_total,source_channel').in('id', bookingIds), 'verify bookings');
    const payments = checked(await db.from('payments').select('booking_id,amount,status,refunded_amount').in('booking_id', bookingIds), 'verify payments');
    for (const spec of batch) {
      const booking = bookings.find(b => b.id === id(spec.key));
      if (!booking || booking.source_channel !== 'demo_seed' || booking.status !== finalState(spec.stage)) throw Error(`Unexpected fixture status: ${spec.key}`);
      const net = payments.filter(p => p.booking_id === booking.id && ['paid', 'partially_refunded'].includes(p.status)).reduce((n, p) => n + Number(p.amount) - Number(p.refunded_amount), 0);
      if (booking.status === 'completed' && net !== Number(booking.quote_total)) throw Error(`Completed fixture is not fully settled: ${spec.key}`);
      if (net > Number(booking.quote_total ?? 0)) throw Error(`Fixture is overpaid: ${spec.key}`);
      if (spec.stage === 'refund' && net !== 0) throw Error('Refund fixture must have zero net collection');
    }
  }
  console.log(`Verified ${specs.length} booking states and payment balances.`);
}
if (apply) {
  writeFileSync('.demo-seed-report.json', JSON.stringify(report, null, 2) + '\n');
  const md = ['# Fictional workflow demo data', '', `Generated ${report.generatedAt}. All names, credentials, evidence, ratings and financial records are fictional test fixtures. No money was moved.`, '',
    'Use the password in `SEED_TEST_PASSWORD` in your local `.env.local`. No password is stored in this report.', '', '## Accounts', '', '| Role/status | Full fictional name | Login | Category |', '|---|---|---|---|',
    ...report.accounts.map(p => `| ${p.status ?? p.role} | ${p.name} | ${p.email} | ${p.category ?? ''} |`), '',
    '## Recommendation test bookings', '', '| Service | Category | Admin booking | Customer |', '|---|---|---|---|',
    ...report.recommendations.map(b => `| ${b.service} | ${b.category} | [Open](http://localhost:3000${b.adminUrl}) | ${b.customer} |`), '',
    '## Workflow scenarios', '', '| Scenario | Service | Current status | Admin booking | Customer | Provider |', '|---|---|---|---|---|---|',
    ...report.scenarios.map(b => `| ${b.stage} | ${b.service} | ${b.status} | [Open](http://localhost:3000${b.adminUrl}) | ${b.customer} | ${b.provider ?? ''} |`), '',
    'The seeder preserves existing records on rerun. Finish testing existing fixtures in the UI; rerunning does not reset them. The verifier expects the original scenario statuses.', '',
    'Historical jobs are deliberately backdated; most workflow scenarios use future appointments and may need rescheduling before arrival/start actions. Documents and signatures say SAMPLE ONLY / NOT VALID. Company reviews are unpublished. No notification delivery service or payment gateway is invoked.', ''];
  writeFileSync('docs/DEMO_TEST_DATA.md', md.join('\n'));
}
console.log('Demo seed verification passed. Accounts use SEED_TEST_PASSWORD; see docs/DEMO_TEST_DATA.md.');
