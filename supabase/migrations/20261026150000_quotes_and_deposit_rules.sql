-- Phase 9, steps 9.1 to 9.7: site inspection, quote, admin approval, customer answer, expiry,
-- payment tier, deposit rule and milestones. PayMongo (9.8 onward) is a later migration.
--
-- Owner decisions (decision-log #33):
--   Q18  The deposit is paid after the customer accepts the provider's quote.
--   Q26  Minor jobs are paid in full up front (100 percent). Standard and Large jobs pay a
--        50 percent deposit. Large jobs also pay 40 percent across milestones and hold back 10.
-- Working defaults (not decided by the owner, stored in config so they can change):
--   quote.expiry_hours = 72, milestone count 2 to 4.

alter type public.quote_status add value if not exists 'expired';

-- ---------------------------------------------------------------------------------------------
-- Config

insert into public.config (key, value, description) values
  ('deposit.percent_by_tier', '{"minor":100,"standard":50,"large":50}',
    'Percent of the approved quote paid through the system before the job is scheduled (Q26). Minor is paid in full'),
  ('quote.expiry_hours', '72',
    'Hours the customer has to answer an approved quote (working default, owner to confirm)'),
  ('quote.milestone_count', '{"min":2,"max":4}',
    'Large jobs: how many milestones a quote must have (plan step 9.7)')
on conflict (key) do nothing;

update public.config
set description = 'Superseded by deposit.percent_by_tier (decision-log #33). Not read by the app'
where key = 'deposit.percent';

-- ---------------------------------------------------------------------------------------------
-- Tables

alter table public.quotes
  add column if not exists payment_tier public.payment_tier,
  add column if not exists deposit_amount numeric(12, 2) check (deposit_amount is null or deposit_amount >= 0),
  add column if not exists expires_at timestamptz,
  add column if not exists decision_note text,
  add column if not exists decided_at timestamptz;

-- One live quote per booking. A new quote replaces an open one, never sits beside it.
create unique index if not exists quotes_one_live_per_booking
  on public.quotes (booking_id) where status in ('proposed', 'approved', 'accepted');

-- Step 9.2: what the provider found at the site. The photos live in the proof-photos bucket,
-- first folder = booking id (existing storage policy).
create table public.site_inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  notes text not null check (char_length(btrim(notes)) >= 10),
  photo_paths text[] not null default '{}',
  arrival_distance_m double precision not null check (arrival_distance_m >= 0),
  gps_accuracy_m double precision check (gps_accuracy_m is null or gps_accuracy_m >= 0),
  created_at timestamptz not null default now()
);
alter table public.site_inspections enable row level security;
grant select on public.site_inspections to authenticated;
create policy "site inspections: read as party or admin" on public.site_inspections for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));

-- ---------------------------------------------------------------------------------------------
-- A customer must not see a quote, or its milestones, before an admin approves it (step 9.4).

drop policy if exists "quotes: read as party or admin" on public.quotes;
create policy "quotes: provider and admin read all, customer reads approved" on public.quotes
  for select to authenticated
  using (
    (select public.is_booking_provider(booking_id))
    or (select public.is_admin())
    or ((select public.is_booking_customer(booking_id)) and status in ('approved', 'accepted'))
  );

drop policy if exists "milestones: read as party or admin" on public.milestones;
create policy "milestones: provider and admin read, customer reads once the quote is approved" on public.milestones
  for select to authenticated
  using (
    (select public.is_booking_provider(booking_id))
    or (select public.is_admin())
    or (
      (select public.is_booking_customer(booking_id))
      and exists (
        select 1 from public.quotes q
        where q.booking_id = milestones.booking_id and q.status in ('approved', 'accepted')
      )
    )
  );

-- ---------------------------------------------------------------------------------------------
-- Helpers (not callable from the browser)

-- Step 9.6: the tier comes from the quote value and the major flag, using config thresholds.
create or replace function public.payment_tier_for(p_amount numeric, p_major boolean)
returns public.payment_tier
language sql stable security definer set search_path = ''
as $$
  select case
    when coalesce(p_major, false) then 'large'::public.payment_tier
    when p_amount >= coalesce((select (c.value ->> 'large_from')::numeric from public.config c where c.key = 'tiers'), 80000)
      then 'large'::public.payment_tier
    when p_amount < coalesce((select (c.value ->> 'minor_below')::numeric from public.config c where c.key = 'tiers'), 20000)
      then 'minor'::public.payment_tier
    else 'standard'::public.payment_tier
  end
$$;
revoke all on function public.payment_tier_for(numeric, boolean) from public, anon, authenticated;

-- Q26: the amount paid through the system before scheduling.
create or replace function public.deposit_for(p_amount numeric, p_tier public.payment_tier)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(
    p_amount * coalesce(
      (select (c.value ->> p_tier::text)::numeric from public.config c where c.key = 'deposit.percent_by_tier'),
      case when p_tier = 'minor' then 100 else 50 end
    ) / 100, 2)
$$;
revoke all on function public.deposit_for(numeric, public.payment_tier) from public, anon, authenticated;

-- Large jobs: the milestones must add up to the milestone share of the quote (40 percent).
create or replace function public.milestone_target(p_amount numeric)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select round(p_amount * coalesce((select (c.value ->> 'milestones')::numeric from public.config c where c.key = 'large.split'), 40) / 100, 2)
$$;
revoke all on function public.milestone_target(numeric) from public, anon, authenticated;

create or replace function public.milestones_valid(p_booking_id uuid, p_amount numeric)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_min integer := coalesce((select (c.value ->> 'min')::integer from public.config c where c.key = 'quote.milestone_count'), 2);
  v_max integer := coalesce((select (c.value ->> 'max')::integer from public.config c where c.key = 'quote.milestone_count'), 4);
  v_count integer;
  v_sum numeric;
begin
  select count(*), coalesce(sum(m.amount), 0) into v_count, v_sum
  from public.milestones m where m.booking_id = p_booking_id;
  return v_count between v_min and v_max and abs(v_sum - public.milestone_target(p_amount)) <= 0.01;
end;
$$;
revoke all on function public.milestones_valid(uuid, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Step 9.2: the provider records the site inspection. Same 200 m rule as the daily check in.
-- record_provider_arrival only works once the booking is on the way (after the deposit), so a
-- visit before the quote needs its own check. The radius is read from the same config key.

create or replace function public.record_site_inspection(
  p_booking_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_accuracy_m double precision,
  p_notes text,
  p_photo_paths text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_pin extensions.geography;
  v_here extensions.geography;
  v_distance double precision;
  v_radius double precision;
  v_path text;
  v_paths text[] := '{}';
  v_notes text := btrim(coalesce(p_notes, ''));
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'accepted' then
    raise exception 'A site inspection is recorded after you accept and before you send the quote' using errcode = 'P0001';
  end if;
  if not (v_booking.is_major_renovation or coalesce(v_booking.job_class = 'major', false)) then
    raise exception 'A site inspection is only needed for large jobs' using errcode = 'P0001';
  end if;
  if char_length(v_notes) < 10 then
    raise exception 'Write what you found, at least 10 characters' using errcode = 'P0001';
  end if;
  if p_longitude is null or p_latitude is null or p_longitude < -180 or p_longitude > 180
     or p_latitude < -90 or p_latitude > 90 or p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100000 then
    raise exception 'GPS returned invalid coordinates' using errcode = 'P0001';
  end if;

  foreach v_path in array coalesce(p_photo_paths, '{}') loop
    if v_path is null or char_length(v_path) > 300 or position(p_booking_id::text || '/' in v_path) <> 1 or v_path like '%..%' then
      raise exception 'A photo is not saved for this booking' using errcode = 'P0001';
    end if;
    v_paths := v_paths || v_path;
  end loop;
  if coalesce(array_length(v_paths, 1), 0) > 10 then
    raise exception 'Add up to 10 photos' using errcode = 'P0001';
  end if;

  select a.location into v_pin from public.addresses a where a.id = v_booking.address_id;
  if v_pin is null then raise exception 'The booking does not have a saved map pin' using errcode = 'P0001'; end if;
  v_here := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  v_distance := extensions.st_distance(v_pin, v_here);
  select (c.value #>> '{}')::double precision into v_radius from public.config c where c.key = 'arrival.radius_m';
  v_radius := coalesce(v_radius, 200);

  if v_distance > v_radius then
    return jsonb_build_object('recorded', false, 'distance_m', v_distance, 'allowed_radius_m', v_radius, 'notify', '[]'::jsonb);
  end if;

  insert into public.site_inspections (booking_id, provider_id, notes, photo_paths, arrival_distance_m, gps_accuracy_m)
  values (p_booking_id, v_uid, left(v_notes, 2000), v_paths, v_distance, p_accuracy_m)
  on conflict (booking_id) do update set
    notes = excluded.notes, photo_paths = excluded.photo_paths,
    arrival_distance_m = excluded.arrival_distance_m, gps_accuracy_m = excluded.gps_accuracy_m,
    created_at = now();
  perform public.mark_booking_site_inspected(p_booking_id);
  perform public.write_audit(v_uid, 'booking.site_inspection_recorded', 'bookings', p_booking_id::text, null,
    jsonb_build_object('distance_m', v_distance, 'photos', coalesce(array_length(v_paths, 1), 0)));

  return jsonb_build_object(
    'recorded', true, 'distance_m', v_distance, 'allowed_radius_m', v_radius,
    'notify', jsonb_build_array(jsonb_build_object(
      'profile_id', v_booking.customer_id, 'event', 'inspection.recorded',
      'title', 'Site inspection done',
      'body', 'Your provider visited and will send a quote soon.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app'))));
end;
$$;
revoke all on function public.record_site_inspection(uuid, double precision, double precision, double precision, text, text[]) from public, anon;
grant execute on function public.record_site_inspection(uuid, double precision, double precision, double precision, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Steps 9.3 and 9.7: the provider (the foreman on large jobs) proposes class, price and, for large
-- jobs, the milestones. p_milestones looks like [{"title":"Rough-in done","amount":12000}, ...].

create or replace function public.propose_quote(
  p_booking_id uuid,
  p_amount numeric,
  p_class public.job_class,
  p_notes text,
  p_milestones jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_amount numeric;
  v_class public.job_class := p_class;
  v_major boolean;
  v_tier public.payment_tier;
  v_quote public.quotes%rowtype;
  v_notes text := btrim(coalesce(p_notes, ''));
  v_items jsonb := coalesce(p_milestones, '[]'::jsonb);
  v_item jsonb;
  v_position integer := 0;
  v_sum numeric := 0;
  v_title text;
  v_item_amount numeric;
  v_min integer := coalesce((select (c.value ->> 'min')::integer from public.config c where c.key = 'quote.milestone_count'), 2);
  v_max integer := coalesce((select (c.value ->> 'max')::integer from public.config c where c.key = 'quote.milestone_count'), 4);
  v_notify jsonb := '[]'::jsonb;
  v_admin record;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status not in ('accepted', 'quoted') then
    raise exception 'This job is not waiting for a quote' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.quotes where booking_id = p_booking_id and status = 'accepted') then
    raise exception 'The customer already accepted a quote' using errcode = 'P0001';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > 10000000 then
    raise exception 'Enter a price between 1 and 10,000,000 pesos' using errcode = 'P0001';
  end if;
  v_amount := round(p_amount, 2);
  if char_length(v_notes) < 10 then
    raise exception 'Say what the price covers, at least 10 characters' using errcode = 'P0001';
  end if;
  if v_class is null then raise exception 'Choose minor or major' using errcode = 'P0001'; end if;

  -- A job already marked large stays large. The provider can raise a minor job to major, not the reverse.
  if coalesce(v_booking.job_class = 'major', false) or v_booking.is_major_renovation then v_class := 'major'; end if;
  v_major := v_class = 'major' or v_booking.is_major_renovation;

  -- Step 9.2: a large job is quoted only after the site inspection is recorded.
  if v_major and v_booking.site_inspected_at is null then
    raise exception 'Record the site inspection before you send a quote for a large job' using errcode = 'P0001';
  end if;

  v_tier := public.payment_tier_for(v_amount, v_major);

  if v_tier = 'large' then
    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between v_min and v_max then
      raise exception 'A large job needs % to % milestones', v_min, v_max using errcode = 'P0001';
    end if;
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_title := btrim(coalesce(v_item ->> 'title', ''));
      if char_length(v_title) < 5 or char_length(v_title) > 120 then
        raise exception 'Each milestone needs a title of 5 to 120 characters' using errcode = 'P0001';
      end if;
      begin
        v_item_amount := round((v_item ->> 'amount')::numeric, 2);
      exception when others then
        raise exception 'Each milestone needs an amount' using errcode = 'P0001';
      end;
      if v_item_amount is null or v_item_amount <= 0 then
        raise exception 'Each milestone needs an amount above zero' using errcode = 'P0001';
      end if;
      v_sum := v_sum + v_item_amount;
    end loop;
    if abs(v_sum - public.milestone_target(v_amount)) > 0.01 then
      raise exception 'Milestones must add up to % pesos (the milestone share of the price)', public.milestone_target(v_amount)
        using errcode = 'P0001';
    end if;
  end if;

  -- A new quote replaces any open one.
  update public.quotes set status = 'superseded', decided_at = coalesce(decided_at, now())
  where booking_id = p_booking_id and status in ('proposed', 'approved');

  insert into public.quotes (booking_id, proposed_by, amount, job_class, status, notes, payment_tier, deposit_amount)
  values (p_booking_id, v_uid, v_amount, v_class, 'proposed', left(v_notes, 1000), v_tier, public.deposit_for(v_amount, v_tier))
  returning * into v_quote;

  -- Milestones are only editable before the customer accepts, so every existing row is still pending.
  delete from public.milestones where booking_id = p_booking_id and status = 'pending';
  if v_tier = 'large' then
    for v_item in select value from jsonb_array_elements(v_items) loop
      v_position := v_position + 1;
      insert into public.milestones (booking_id, position, title, amount)
      values (p_booking_id, v_position, btrim(v_item ->> 'title'), round((v_item ->> 'amount')::numeric, 2));
    end loop;
  end if;

  if v_booking.status = 'accepted' then
    perform public.change_booking_status(p_booking_id, 'quoted', null);
  end if;

  perform public.write_audit(v_uid, 'quote.proposed', 'quotes', v_quote.id::text, null,
    jsonb_build_object('booking_id', p_booking_id, 'amount', v_amount, 'class', v_class, 'tier', v_tier));

  for v_admin in select id from public.profiles where role = 'admin' loop
    v_notify := v_notify || jsonb_build_array(jsonb_build_object(
      'profile_id', v_admin.id, 'event', 'quote.proposed',
      'title', 'A quote needs approval',
      'body', 'A provider sent a quote. Check the class and price, then approve or send it back.',
      'link', '/admin', 'channels', jsonb_build_array('in_app')));
  end loop;
  return jsonb_build_object('quote_id', v_quote.id, 'tier', v_tier, 'notify', v_notify);
end;
$$;
revoke all on function public.propose_quote(uuid, numeric, public.job_class, text, jsonb) from public, anon;
grant execute on function public.propose_quote(uuid, numeric, public.job_class, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Step 9.4: an admin approves the class and price, or sends the quote back with a reason.
-- The admin can change the class. The admin cannot change the provider's price. To change the
-- price the admin sends the quote back, so no money figure is edited silently.

create or replace function public.decide_quote(
  p_quote_id uuid,
  p_approve boolean,
  p_note text default null,
  p_class public.job_class default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_booking public.bookings%rowtype;
  v_class public.job_class;
  v_major boolean;
  v_tier public.payment_tier;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_hours numeric := coalesce((select (c.value #>> '{}')::numeric from public.config c where c.key = 'quote.expiry_hours'), 72);
  v_notify jsonb;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an admin can decide a quote' using errcode = '42501';
  end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'proposed' then
    raise exception 'This quote was already decided or replaced' using errcode = 'P0001';
  end if;
  select * into v_booking from public.bookings where id = v_quote.booking_id for update;
  if v_booking.status <> 'quoted' then
    raise exception 'This booking is no longer waiting for a quote' using errcode = 'P0001';
  end if;

  if not p_approve then
    if v_note is null or char_length(v_note) < 10 then
      raise exception 'Say why, at least 10 characters, so the provider can fix it' using errcode = 'P0001';
    end if;
    update public.quotes set status = 'declined', decision_note = left(v_note, 500), decided_at = now(), approved_by = null
    where id = p_quote_id;
    perform public.write_audit(v_uid, 'quote.sent_back', 'quotes', p_quote_id::text, left(v_note, 500),
      jsonb_build_object('booking_id', v_quote.booking_id));
    return jsonb_build_object('outcome', 'sent_back', 'booking_id', v_quote.booking_id, 'notify', jsonb_build_array(
      jsonb_build_object('profile_id', v_quote.proposed_by, 'event', 'quote.sent_back',
        'title', 'Your quote needs changes', 'body', left(v_note, 200),
        'link', '/provider/jobs/' || v_quote.booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
  end if;

  v_class := coalesce(p_class, v_quote.job_class);
  v_major := v_class = 'major' or v_booking.is_major_renovation;
  v_tier := public.payment_tier_for(v_quote.amount, v_major);

  if v_tier = 'large' and not public.milestones_valid(v_quote.booking_id, v_quote.amount) then
    raise exception 'This is a large job. Send it back so the provider adds 2 to 4 milestones that match the price'
      using errcode = 'P0001';
  end if;
  if v_tier <> 'large' then
    delete from public.milestones where booking_id = v_quote.booking_id and status = 'pending';
  end if;

  update public.quotes set
    status = 'approved', approved_by = v_uid, decided_at = now(), decision_note = left(v_note, 500),
    job_class = v_class, payment_tier = v_tier, deposit_amount = public.deposit_for(v_quote.amount, v_tier),
    expires_at = now() + make_interval(hours => v_hours::integer)
  where id = p_quote_id;
  update public.bookings set
    job_class = v_class, payment_tier = v_tier, quote_total = v_quote.amount,
    deposit_amount = public.deposit_for(v_quote.amount, v_tier)
  where id = v_quote.booking_id;

  perform public.write_audit(v_uid, 'quote.approved', 'quotes', p_quote_id::text, left(v_note, 500),
    jsonb_build_object('booking_id', v_quote.booking_id, 'amount', v_quote.amount, 'class', v_class, 'tier', v_tier,
      'class_changed', v_class is distinct from v_quote.job_class));

  v_notify := jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'quote.ready',
      'title', 'Your quote is ready', 'body', 'Open your booking to see the price and answer.',
      'link', '/customer/bookings/' || v_quote.booking_id, 'channels', jsonb_build_array('in_app', 'email')),
    jsonb_build_object('profile_id', v_quote.proposed_by, 'event', 'quote.approved',
      'title', 'Your quote was approved', 'body', 'The customer can now accept it.',
      'link', '/provider/jobs/' || v_quote.booking_id, 'channels', jsonb_build_array('in_app')));
  return jsonb_build_object('outcome', 'approved', 'booking_id', v_quote.booking_id, 'tier', v_tier, 'notify', v_notify);
end;
$$;
revoke all on function public.decide_quote(uuid, boolean, text, public.job_class) from public, anon;
grant execute on function public.decide_quote(uuid, boolean, text, public.job_class) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The customer accepts or declines an approved quote. Accepting does not move the booking:
-- it stays "quoted" until the deposit is paid (Q18), and only trusted server code moves it to
-- deposit_paid. Declining cancels the request, which is how the status moves are defined
-- (booking_status_moves: quoted to cancelled by the customer). Any fee is Phase 10.

create or replace function public.respond_to_quote(p_quote_id uuid, p_accept boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_quote public.quotes%rowtype;
  v_booking public.bookings%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_quote.booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Quote not found' using errcode = 'P0002'; end if;
  if v_quote.status <> 'approved' then
    raise exception 'This quote is no longer open' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'quoted' then
    raise exception 'This booking is not waiting for your answer' using errcode = 'P0001';
  end if;

  if v_quote.expires_at is not null and v_quote.expires_at <= now() then
    update public.quotes set status = 'expired' where id = p_quote_id;
    perform public.write_audit(v_uid, 'quote.expired', 'quotes', p_quote_id::text, null,
      jsonb_build_object('booking_id', v_quote.booking_id));
    return jsonb_build_object('outcome', 'expired', 'booking_id', v_quote.booking_id, 'notify', '[]'::jsonb);
  end if;

  if p_accept then
    update public.quotes set status = 'accepted', decided_at = now() where id = p_quote_id;
    perform public.write_audit(v_uid, 'quote.accepted', 'quotes', p_quote_id::text, null,
      jsonb_build_object('booking_id', v_quote.booking_id, 'amount', v_quote.amount, 'deposit', v_quote.deposit_amount, 'tier', v_quote.payment_tier));
    return jsonb_build_object(
      'outcome', 'accepted', 'booking_id', v_quote.booking_id,
      'deposit_amount', v_quote.deposit_amount, 'payment_tier', v_quote.payment_tier,
      'notify', jsonb_build_array(jsonb_build_object(
        'profile_id', v_quote.proposed_by, 'event', 'quote.accepted',
        'title', 'The customer accepted your quote',
        'body', 'The job is scheduled once the customer pays.',
        'link', '/provider/jobs/' || v_quote.booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
  end if;

  update public.quotes set status = 'declined', decision_note = left(v_reason, 500), decided_at = now() where id = p_quote_id;
  perform public.change_booking_status(v_quote.booking_id, 'cancelled', coalesce(left(v_reason, 500), 'Quote declined by the customer'));
  perform public.write_audit(v_uid, 'quote.declined', 'quotes', p_quote_id::text, left(v_reason, 500),
    jsonb_build_object('booking_id', v_quote.booking_id));
  return jsonb_build_object('outcome', 'declined', 'booking_id', v_quote.booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_quote.proposed_by, 'event', 'quote.declined',
      'title', 'The customer declined the quote', 'body', 'This booking is cancelled.',
      'link', '/provider/jobs', 'channels', jsonb_build_array('in_app'))));
end;
$$;
revoke all on function public.respond_to_quote(uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_quote(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Step 9.5: approved quotes the customer did not answer in time. Server only.
-- The booking stays "quoted" so the provider can send a new quote.

create or replace function public.expire_stale_quotes(p_booking_id uuid default null)
returns table (quote_id uuid, booking_id uuid, provider_id uuid, customer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
begin
  for v_row in
    with expired as (
      update public.quotes q set status = 'expired'
      where q.status = 'approved' and q.expires_at is not null and q.expires_at <= now()
        and (p_booking_id is null or q.booking_id = p_booking_id)
      returning q.id as qid, q.booking_id as bid, q.proposed_by as pid
    )
    select e.qid, e.bid, e.pid, b.customer_id as cid
    from expired e join public.bookings b on b.id = e.bid
  loop
    perform public.write_audit(null, 'quote.expired', 'quotes', v_row.qid::text, null,
      jsonb_build_object('booking_id', v_row.bid));
    quote_id := v_row.qid;
    booking_id := v_row.bid;
    provider_id := v_row.pid;
    customer_id := v_row.cid;
    return next;
  end loop;
end;
$$;
revoke all on function public.expire_stale_quotes(uuid) from public, anon, authenticated;
grant execute on function public.expire_stale_quotes(uuid) to service_role;
