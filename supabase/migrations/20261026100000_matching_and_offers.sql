-- Phase 7: matching, provider choice and offers.
-- Decisions: decision-log.md #30 (open-questions Q27, Q29, Q31 to Q35).
--  * Normal jobs: the customer picks from a ranked list. A decline or timeout puts the job back
--    to "open" and the customer picks again (or ticked "offer to the next best automatically").
--  * Urgent jobs: the system offers down the ranked list, 15 minutes per offer.
--  * Three misses (declines or timeouts) send the job to the admin queue.
--  * Large jobs (job_class = major): an admin assigns one foreman from the ranked list.
--    The customer may ask for a different foreman. The admin decides.
-- Ranking itself runs in TypeScript (src/lib/matching). SQL decides who is allowed to be offered
-- the job and keeps the state machine safe. Anything that must be sent to people comes back as
-- a jsonb "notify" list that the server routes deliver.

-- ---------------------------------------------------------------------------------------------
-- Columns and settings

alter table public.bookings
  add column if not exists auto_chain boolean not null default false,
  add column if not exists needs_admin boolean not null default false,
  add column if not exists needs_admin_reason text;

create index if not exists bookings_needs_admin_idx on public.bookings (needs_admin) where needs_admin;

insert into public.config (key, value, description) values
  ('ranking.reliability', '{"accept_rate":40,"on_time":30,"no_cancel":20,"no_show":10}',
    'How the reliability score is built, in percent. Must add up to 100 (Q27)'),
  ('ranking.new_provider', '{"min_jobs":3,"rating":4.0,"reliability":70}',
    'Providers with fewer finished jobs than min_jobs start at this rating (stars) and reliability (0 to 100)'),
  ('ranking.late_grace_minutes', '15',
    'A provider counts as on time if they check in within this many minutes of the booked start')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- Foreman change requests (Q32 to Q34)

create table if not exists public.foreman_change_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  current_foreman_id uuid references public.profiles (id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 10 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text check (decision_note is null or char_length(decision_note) <= 500),
  new_foreman_id uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists foreman_change_requests_booking_idx on public.foreman_change_requests (booking_id);
create unique index if not exists foreman_change_one_pending on public.foreman_change_requests (booking_id) where status = 'pending';

alter table public.foreman_change_requests enable row level security;
grant select on public.foreman_change_requests to authenticated;
drop policy if exists "foreman change: read as the customer or admin" on public.foreman_change_requests;
create policy "foreman change: read as the customer or admin" on public.foreman_change_requests
  for select to authenticated
  using (public.is_admin() or public.is_booking_customer(booking_id));

-- ---------------------------------------------------------------------------------------------
-- Helpers (not callable from the browser)

create or replace function public.cfg_number(p_key text, p_default numeric)
returns numeric
language sql stable security definer set search_path = ''
as $$ select coalesce((select (c.value #>> '{}')::numeric from public.config c where c.key = p_key), p_default) $$;
revoke all on function public.cfg_number(text, numeric) from public, anon, authenticated;

-- Can this provider be offered this job? Approved, does the service, has not already said no or
-- timed out on it. The distance limit applies to customer picks and automatic offers, not to an
-- admin choosing by hand.
create or replace function public.provider_can_take(p_booking_id uuid, p_provider_id uuid, p_check_distance boolean)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.bookings b
    join public.provider_profiles pp on pp.profile_id = p_provider_id
    where b.id = p_booking_id
      and pp.status = 'approved'
      and b.customer_id <> p_provider_id
      and exists (select 1 from public.provider_services ps where ps.provider_id = p_provider_id and ps.service_id = b.service_id)
      and not exists (
        select 1 from public.offers o
        where o.booking_id = b.id and o.provider_id = p_provider_id and o.status in ('declined', 'expired')
      )
      and (
        not p_check_distance
        or exists (
          select 1 from public.addresses a
          where a.id = b.address_id and a.location is not null and pp.base_location is not null
            and extensions.st_dwithin(pp.base_location, a.location, public.cfg_number('ranking.max_distance_km', 15) * 1000)
        )
      )
  )
$$;
revoke all on function public.provider_can_take(uuid, uuid, boolean) from public, anon, authenticated;

-- Create the offer and move the booking to "offered". The caller has already checked who may do it.
create or replace function public.make_offer(p_booking_id uuid, p_provider_id uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_minutes numeric;
  v_offer public.offers%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' then
    raise exception 'This booking is not waiting for a provider';
  end if;
  v_minutes := case when v_booking.is_urgent
    then public.cfg_number('offer.window_minutes.urgent', 15)
    else public.cfg_number('offer.window_minutes.normal', 30) end;

  insert into public.offers (booking_id, provider_id, kind, expires_at)
  values (p_booking_id, p_provider_id, p_kind, now() + make_interval(mins => v_minutes::integer))
  returning * into v_offer;

  update public.bookings
  set picked_provider_id = case when p_kind in ('customer_pick', 'auto_chain') then p_provider_id else null end,
      needs_admin = false,
      needs_admin_reason = null
  where id = p_booking_id;
  perform public.change_booking_status(p_booking_id, 'offered', null);

  return jsonb_build_object(
    'offer_id', v_offer.id,
    'expires_at', v_offer.expires_at,
    'notify', jsonb_build_array(jsonb_build_object(
      'profile_id', p_provider_id,
      'event', 'offer.new',
      'title', case when v_booking.is_urgent then 'Urgent job offer' else 'New job offer' end,
      'body', case when v_booking.is_urgent
        then 'An urgent job needs a provider. Answer within ' || v_minutes::integer || ' minutes.'
        else 'A customer would like you for a job. Answer within ' || v_minutes::integer || ' minutes.' end,
      'link', '/provider',
      'channels', jsonb_build_array('in_app', 'email')
    ))
  );
end;
$$;
revoke all on function public.make_offer(uuid, uuid, text) from public, anon, authenticated;

-- A decline or a timeout. Puts the booking back to open and says who acts next:
-- 'auto' (the server offers the next ranked provider), 'customer' (they pick again) or 'admin'.
create or replace function public.register_offer_miss(p_offer_id uuid, p_status public.offer_status, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_booking public.bookings%rowtype;
  v_next text;
  v_misses integer;
  v_why text;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'pending' then
    raise exception 'This offer is no longer open';
  end if;
  select * into v_booking from public.bookings where id = v_offer.booking_id for update;

  perform public.change_booking_status(v_offer.booking_id, 'open', p_reason);
  update public.offers
  set status = p_status, responded_at = now(), decline_reason = left(p_reason, 300)
  where id = p_offer_id;

  v_misses := v_booking.miss_count + 1;
  if v_offer.kind in ('foreman', 'admin_assign') then
    v_next := 'admin';
    v_why := case when p_status = 'expired'
      then 'The provider offered the job did not answer in time. Assign another provider.'
      else 'The provider offered the job declined it. Assign another provider.' end;
  elsif v_misses >= public.cfg_number('offer.max_misses', 3) then
    v_next := 'admin';
    v_why := 'Three providers declined or did not answer. Please help this customer find one.';
  elsif v_booking.is_urgent or v_booking.auto_chain then
    v_next := 'auto';
  else
    v_next := 'customer';
  end if;

  update public.bookings
  set miss_count = v_misses,
      picked_provider_id = null,
      needs_admin = (v_next = 'admin'),
      needs_admin_reason = case when v_next = 'admin' then v_why else null end
  where id = v_offer.booking_id;

  perform public.write_audit(
    auth.uid(), 'offer.' || p_status::text, 'offers', p_offer_id::text, p_reason,
    jsonb_build_object('booking_id', v_offer.booking_id, 'provider_id', v_offer.provider_id, 'next', v_next)
  );
  return v_next;
end;
$$;
revoke all on function public.register_offer_miss(uuid, public.offer_status, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Ranking input. Only the server (service role) may read it, because it covers every provider.

create or replace function public.matching_candidates(p_booking_id uuid)
returns table (
  provider_id uuid, first_name text, last_initial text, daily_rate numeric, distance_m double precision,
  review_count bigint, avg_stars numeric, finished_jobs bigint,
  offers_total bigint, offers_accepted bigint, provider_cancels bigint,
  arrivals_total bigint, arrivals_on_time bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pin extensions.geography;
  v_service uuid;
  v_max_m double precision := public.cfg_number('ranking.max_distance_km', 15) * 1000;
  v_grace integer := public.cfg_number('ranking.late_grace_minutes', 15)::integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Matching must use the validated server route' using errcode = '42501';
  end if;
  select a.location, b.service_id into v_pin, v_service
  from public.bookings b join public.addresses a on a.id = b.address_id
  where b.id = p_booking_id;
  if v_pin is null then return; end if;

  return query
    select pp.profile_id, p.first_name,
      case when nullif(p.last_name, '') is null then '' else left(p.last_name, 1) || '.' end,
      pp.daily_rate,
      extensions.st_distance(pp.base_location, v_pin),
      (select count(*) from public.reviews r where r.provider_id = pp.profile_id and not r.hidden),
      (select round(avg(r.stars)::numeric, 2) from public.reviews r where r.provider_id = pp.profile_id and not r.hidden),
      (select count(*) from public.bookings fb where fb.provider_id = pp.profile_id
         and fb.status in ('done', 'signed', 'balance_paid', 'completed')),
      (select count(*) from public.offers o where o.provider_id = pp.profile_id and o.status in ('accepted', 'declined', 'expired')),
      (select count(*) from public.offers o where o.provider_id = pp.profile_id and o.status = 'accepted'),
      (select count(*) from public.cancellations c where c.cancelled_by = pp.profile_id and c.cancelled_by_role = 'provider'),
      (select count(*) from public.work_days w join public.bookings wb on wb.id = w.booking_id
         where w.provider_id = pp.profile_id and w.arrived_at is not null and wb.preferred_start is not null),
      (select count(*) from public.work_days w join public.bookings wb on wb.id = w.booking_id
         where w.provider_id = pp.profile_id and w.arrived_at is not null and wb.preferred_start is not null
           and w.arrived_at <= wb.preferred_start + make_interval(mins => v_grace))
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where public.provider_can_take(p_booking_id, pp.profile_id, true)
      and extensions.st_dwithin(pp.base_location, v_pin, v_max_m)
    order by extensions.st_distance(pp.base_location, v_pin), pp.profile_id;
end;
$$;
revoke all on function public.matching_candidates(uuid) from public, anon, authenticated;
grant execute on function public.matching_candidates(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Customer actions

-- Normal jobs: the customer picks one provider from the list.
create or replace function public.pick_provider(p_booking_id uuid, p_provider_id uuid, p_auto_chain boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' then raise exception 'This booking is not waiting for you to pick a provider'; end if;
  if v_booking.is_urgent then raise exception 'Urgent jobs are offered to providers automatically'; end if;
  if v_booking.job_class = 'major' then raise exception 'An admin assigns a foreman for large jobs'; end if;
  if not public.provider_can_take(p_booking_id, p_provider_id, true) then
    raise exception 'This provider is not available for your job. Choose someone from the list';
  end if;

  update public.bookings set auto_chain = coalesce(p_auto_chain, false) where id = p_booking_id;
  v_result := public.make_offer(p_booking_id, p_provider_id, 'customer_pick');
  perform public.write_audit(v_uid, 'offer.created', 'offers', v_result ->> 'offer_id', null,
    jsonb_build_object('booking_id', p_booking_id, 'provider_id', p_provider_id, 'kind', 'customer_pick'));
  return v_result;
end;
$$;
revoke all on function public.pick_provider(uuid, uuid, boolean) from public, anon;
grant execute on function public.pick_provider(uuid, uuid, boolean) to authenticated;

-- The customer asks the admin to help (no providers nearby, or they would rather not choose).
create or replace function public.request_admin_help(p_booking_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' then raise exception 'Only a booking that is waiting for a provider can ask for help'; end if;
  update public.bookings
  set needs_admin = true,
      needs_admin_reason = coalesce(nullif(btrim(left(p_note, 300)), ''), 'The customer asked for help finding a provider.')
  where id = p_booking_id;
  perform public.write_audit(v_uid, 'booking.admin_help', 'bookings', p_booking_id::text, left(p_note, 300), '{}'::jsonb);
end;
$$;
revoke all on function public.request_admin_help(uuid, text) from public, anon;
grant execute on function public.request_admin_help(uuid, text) to authenticated;

-- Large jobs: the customer asks for a different foreman. The admin decides (Q33).
create or replace function public.request_foreman_change(p_booking_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_request public.foreman_change_requests%rowtype;
  v_notify jsonb := '[]'::jsonb;
  v_admin record;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.job_class <> 'major' or v_booking.provider_id is null then
    raise exception 'Only a large job with an assigned foreman can ask for a change';
  end if;
  if v_booking.status not in ('accepted', 'quoted', 'deposit_paid', 'scheduled') then
    raise exception 'A foreman can only be changed before work starts';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Tell us why in at least 10 characters';
  end if;
  if exists (select 1 from public.foreman_change_requests where booking_id = p_booking_id and status = 'pending') then
    raise exception 'You already asked for a change. The admin will answer soon';
  end if;

  insert into public.foreman_change_requests (booking_id, requested_by, current_foreman_id, reason)
  values (p_booking_id, v_uid, v_booking.provider_id, btrim(left(p_reason, 500)))
  returning * into v_request;

  perform public.write_audit(v_uid, 'foreman_change.requested', 'foreman_change_requests', v_request.id::text, btrim(left(p_reason, 500)),
    jsonb_build_object('booking_id', p_booking_id));

  for v_admin in select id from public.profiles where role = 'admin' loop
    v_notify := v_notify || jsonb_build_array(jsonb_build_object(
      'profile_id', v_admin.id, 'event', 'foreman_change.requested',
      'title', 'Foreman change requested',
      'body', 'A customer asked for a different foreman on a large job.',
      'link', '/admin/assignments', 'channels', jsonb_build_array('in_app')));
  end loop;
  return jsonb_build_object('request_id', v_request.id, 'notify', v_notify);
end;
$$;
revoke all on function public.request_foreman_change(uuid, text) from public, anon;
grant execute on function public.request_foreman_change(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Server (service role) actions: urgent and automatic offers, expiry

-- Offer the job to the first provider on the ranked list who is still allowed to take it.
-- The list comes from the ranking code. If nobody on it can be offered, the job goes to admin.
create or replace function public.offer_next_in_list(p_booking_id uuid, p_provider_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Automatic offers must use the validated server route' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' or v_booking.job_class = 'major' then
    return jsonb_build_object('next', 'none', 'notify', '[]'::jsonb);
  end if;

  for v_id in select u.id from unnest(coalesce(p_provider_ids, '{}'::uuid[])) with ordinality as u(id, n) order by u.n loop
    if public.provider_can_take(p_booking_id, v_id, true) then
      return public.make_offer(p_booking_id, v_id, 'auto_chain') || jsonb_build_object('next', 'offered');
    end if;
  end loop;

  update public.bookings
  set needs_admin = true,
      needs_admin_reason = 'No provider nearby could be offered this job. Please help this customer find one.'
  where id = p_booking_id;
  perform public.write_audit(null, 'booking.needs_admin', 'bookings', p_booking_id::text, 'No provider could be offered', '{}'::jsonb);
  return jsonb_build_object('next', 'admin', 'notify', '[]'::jsonb);
end;
$$;
revoke all on function public.offer_next_in_list(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.offer_next_in_list(uuid, uuid[]) to service_role;

-- Offers that ran out of time count as a miss. Runs lazily when a screen opens and from the worker.
create or replace function public.expire_stale_offers(p_booking_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer record;
  v_next text;
  v_out jsonb := '[]'::jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Offer expiry must use the validated server route' using errcode = '42501';
  end if;
  for v_offer in
    select o.id, o.booking_id, o.provider_id from public.offers o
    where o.status = 'pending' and o.expires_at <= now()
      and (p_booking_id is null or o.booking_id = p_booking_id)
    order by o.expires_at
    for update skip locked
  loop
    v_next := public.register_offer_miss(v_offer.id, 'expired', 'No answer in time');
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'offer_id', v_offer.id, 'booking_id', v_offer.booking_id, 'provider_id', v_offer.provider_id, 'next', v_next));
  end loop;
  return v_out;
end;
$$;
revoke all on function public.expire_stale_offers(uuid) from public, anon, authenticated;
grant execute on function public.expire_stale_offers(uuid) to service_role;

-- ---------------------------------------------------------------------------------------------
-- Provider actions

create or replace function public.respond_to_offer(p_offer_id uuid, p_accept boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_offer public.offers%rowtype;
  v_booking public.bookings%rowtype;
  v_next text;
  v_notify jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_offer from public.offers where id = p_offer_id and provider_id = v_uid for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if v_offer.status <> 'pending' then raise exception 'This offer is no longer open'; end if;
  select * into v_booking from public.bookings where id = v_offer.booking_id for update;

  if v_offer.expires_at <= now() then
    v_next := public.register_offer_miss(p_offer_id, 'expired', 'No answer in time');
    return jsonb_build_object('outcome', 'expired', 'next', v_next, 'booking_id', v_offer.booking_id, 'notify', '[]'::jsonb);
  end if;

  if p_accept then
    if not exists (select 1 from public.provider_profiles where profile_id = v_uid and status = 'approved') then
      raise exception 'Your provider account is not approved';
    end if;
    update public.bookings set provider_id = v_uid where id = v_offer.booking_id;
    perform public.change_booking_status(v_offer.booking_id, 'accepted', null);
    update public.offers set status = 'accepted', responded_at = now() where id = p_offer_id;
    perform public.write_audit(v_uid, 'offer.accepted', 'offers', p_offer_id::text, null,
      jsonb_build_object('booking_id', v_offer.booking_id, 'kind', v_offer.kind));
    v_notify := jsonb_build_array(jsonb_build_object(
      'profile_id', v_booking.customer_id, 'event', 'offer.accepted',
      'title', case when v_offer.kind = 'foreman' then 'Your foreman is confirmed' else 'A provider accepted your job' end,
      'body', 'Open your booking to see the next step.',
      'link', '/customer/bookings/' || v_offer.booking_id, 'channels', jsonb_build_array('in_app', 'email')));
    return jsonb_build_object('outcome', 'accepted', 'next', 'none', 'booking_id', v_offer.booking_id, 'notify', v_notify);
  end if;

  v_next := public.register_offer_miss(p_offer_id, 'declined', nullif(btrim(left(p_reason, 300)), ''));
  v_notify := '[]'::jsonb;
  if v_next <> 'auto' then
    v_notify := jsonb_build_array(jsonb_build_object(
      'profile_id', v_booking.customer_id, 'event', 'offer.declined',
      'title', case when v_next = 'admin' then 'We are finding you a provider' else 'Please choose another provider' end,
      'body', case when v_next = 'admin' then 'Our team will help match your job.' else 'The provider you picked could not take the job.' end,
      'link', '/customer/bookings/' || v_offer.booking_id, 'channels', jsonb_build_array('in_app', 'email')));
  end if;
  return jsonb_build_object('outcome', 'declined', 'next', v_next, 'booking_id', v_offer.booking_id, 'notify', v_notify);
end;
$$;
revoke all on function public.respond_to_offer(uuid, boolean, text) from public, anon;
grant execute on function public.respond_to_offer(uuid, boolean, text) to authenticated;

-- What the provider sees on the Offers screen. The street address stays hidden until they accept.
create or replace function public.my_offers()
returns table (
  offer_id uuid, booking_id uuid, kind text, status public.offer_status, expires_at timestamptz,
  created_at timestamptz, service_name text, description text, is_urgent boolean,
  preferred_start timestamptz, job_class public.job_class, barangay text, city text, distance_m double precision
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  return query
    select o.id, o.booking_id, o.kind, o.status, o.expires_at, o.created_at, s.name, b.description,
      b.is_urgent, b.preferred_start, b.job_class, a.barangay, a.city,
      case when pp.base_location is not null and a.location is not null
        then extensions.st_distance(pp.base_location, a.location) end
    from public.offers o
    join public.bookings b on b.id = o.booking_id
    left join public.services s on s.id = b.service_id
    left join public.addresses a on a.id = b.address_id
    left join public.provider_profiles pp on pp.profile_id = o.provider_id
    where o.provider_id = auth.uid()
      and (o.status = 'pending' or o.created_at > now() - interval '30 days')
    order by (o.status = 'pending') desc, o.created_at desc
    limit 100;
end;
$$;
revoke all on function public.my_offers() from public, anon;
grant execute on function public.my_offers() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Admin actions

-- Offer a job to a provider chosen by the admin. Large jobs get a foreman offer.
create or replace function public.admin_offer(p_booking_id uuid, p_provider_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_kind text;
  v_result jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can assign a provider' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' then raise exception 'This booking is not waiting for a provider'; end if;
  if not public.provider_can_take(p_booking_id, p_provider_id, false) then
    raise exception 'This provider cannot take the job. They must be approved, offer the service and not have declined it';
  end if;
  v_kind := case when v_booking.job_class = 'major' then 'foreman' else 'admin_assign' end;
  v_result := public.make_offer(p_booking_id, p_provider_id, v_kind);
  perform public.write_audit(auth.uid(), 'offer.created', 'offers', v_result ->> 'offer_id', null,
    jsonb_build_object('booking_id', p_booking_id, 'provider_id', p_provider_id, 'kind', v_kind));
  return v_result;
end;
$$;
revoke all on function public.admin_offer(uuid, uuid) from public, anon;
grant execute on function public.admin_offer(uuid, uuid) to authenticated;

-- Decide a foreman change request. Approving swaps in the foreman the admin chose.
create or replace function public.decide_foreman_change(
  p_request_id uuid, p_approve boolean, p_note text default null, p_new_provider_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.foreman_change_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_notify jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then raise exception 'Only an admin can decide this' using errcode = '42501'; end if;
  select * into v_request from public.foreman_change_requests where id = p_request_id for update;
  if not found then raise exception 'Request not found' using errcode = 'P0002'; end if;
  if v_request.status <> 'pending' then raise exception 'This request was already decided'; end if;
  select * into v_booking from public.bookings where id = v_request.booking_id for update;

  if p_approve then
    if p_new_provider_id is null or p_new_provider_id = v_booking.provider_id then
      raise exception 'Choose a different provider to be the new foreman';
    end if;
    if not public.provider_can_take(v_booking.id, p_new_provider_id, false) then
      raise exception 'This provider cannot take the job';
    end if;
    update public.bookings set provider_id = p_new_provider_id where id = v_booking.id;
    -- The admin chose this foreman directly, so the offer is recorded as already accepted.
    insert into public.offers (booking_id, provider_id, kind, status, expires_at, responded_at)
    values (v_booking.id, p_new_provider_id, 'foreman', 'accepted', now(), now());
    v_notify := jsonb_build_array(
      jsonb_build_object('profile_id', v_request.requested_by, 'event', 'foreman_change.approved',
        'title', 'Your foreman was changed', 'body', 'An admin assigned a new foreman to your job.',
        'link', '/customer/bookings/' || v_booking.id, 'channels', jsonb_build_array('in_app', 'email')),
      jsonb_build_object('profile_id', p_new_provider_id, 'event', 'foreman_change.assigned',
        'title', 'You are the foreman on a job', 'body', 'An admin assigned you as foreman on a large job.',
        'link', '/provider', 'channels', jsonb_build_array('in_app', 'email')));
    if v_request.current_foreman_id is not null then
      v_notify := v_notify || jsonb_build_array(jsonb_build_object(
        'profile_id', v_request.current_foreman_id, 'event', 'foreman_change.removed',
        'title', 'You were replaced as foreman', 'body', 'An admin assigned a different foreman to this job.',
        'link', '/provider', 'channels', jsonb_build_array('in_app')));
    end if;
  else
    if char_length(btrim(coalesce(p_note, ''))) < 5 then
      raise exception 'Write a short reason for the customer';
    end if;
    v_notify := jsonb_build_array(jsonb_build_object(
      'profile_id', v_request.requested_by, 'event', 'foreman_change.declined',
      'title', 'Your foreman stays the same', 'body', btrim(left(p_note, 500)),
      'link', '/customer/bookings/' || v_booking.id, 'channels', jsonb_build_array('in_app', 'email')));
  end if;

  update public.foreman_change_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      decided_by = v_uid, decision_note = nullif(btrim(left(p_note, 500)), ''),
      new_foreman_id = case when p_approve then p_new_provider_id end, decided_at = now()
  where id = p_request_id;
  perform public.write_audit(v_uid, 'foreman_change.' || case when p_approve then 'approved' else 'declined' end,
    'foreman_change_requests', p_request_id::text, nullif(btrim(left(p_note, 500)), ''),
    jsonb_build_object('booking_id', v_booking.id, 'new_foreman_id', p_new_provider_id));
  return jsonb_build_object('notify', v_notify);
end;
$$;
revoke all on function public.decide_foreman_change(uuid, boolean, text, uuid) from public, anon;
grant execute on function public.decide_foreman_change(uuid, boolean, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- A cancelled booking closes its open offer.

create or replace function public.bookings_close_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.offers set status = 'cancelled', responded_at = now()
    where booking_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_close_offers on public.bookings;
create trigger bookings_close_offers after update of status on public.bookings
  for each row execute function public.bookings_close_offers();
