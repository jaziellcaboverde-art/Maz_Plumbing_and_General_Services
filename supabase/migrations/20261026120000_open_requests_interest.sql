-- Job alerts and "I can do this".
--  * When a normal job opens, every approved provider who declared that service is told about it.
--    The match is on the skills they declared (provider_services), not on distance.
--  * A provider can say "I can do this". That counts as a yes in advance. If few or no providers
--    are near the customer, providers who said yes still appear on the customer's list, even if far.
-- Providers see only the service, area, date and description. No name, street or contact details.

alter table public.bookings add column if not exists providers_alerted_at timestamptz;

create table if not exists public.job_interest (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (booking_id, provider_id)
);
create index if not exists job_interest_provider_idx on public.job_interest (provider_id);

alter table public.job_interest enable row level security;
grant select on public.job_interest to authenticated;
drop policy if exists "job interest: read as the provider, the customer or admin" on public.job_interest;
create policy "job interest: read as the provider, the customer or admin" on public.job_interest
  for select to authenticated
  using (provider_id = (select auth.uid()) or public.is_admin() or public.is_booking_customer(booking_id));

-- A provider who said "I can do this" may be offered the job even when far away.
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
        or exists (select 1 from public.job_interest ji where ji.booking_id = b.id and ji.provider_id = p_provider_id)
        or exists (
          select 1 from public.addresses a
          where a.id = b.address_id and a.location is not null and pp.base_location is not null
            and extensions.st_dwithin(pp.base_location, a.location, public.cfg_number('ranking.max_distance_km', 15) * 1000)
        )
      )
  )
$$;
revoke all on function public.provider_can_take(uuid, uuid, boolean) from public, anon, authenticated;

-- Ranking input again, now with "interested" and without the hard distance cut (the server
-- decides how far to go). Providers who are neither near nor interested are still left out.
drop function if exists public.matching_candidates(uuid);
create function public.matching_candidates(p_booking_id uuid)
returns table (
  provider_id uuid, first_name text, last_initial text, daily_rate numeric, distance_m double precision,
  review_count bigint, avg_stars numeric, finished_jobs bigint,
  offers_total bigint, offers_accepted bigint, provider_cancels bigint,
  arrivals_total bigint, arrivals_on_time bigint, interested boolean
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pin extensions.geography;
  v_grace integer := public.cfg_number('ranking.late_grace_minutes', 15)::integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Matching must use the validated server route' using errcode = '42501';
  end if;
  select a.location into v_pin
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
           and w.arrived_at <= wb.preferred_start + make_interval(mins => v_grace)),
      exists (select 1 from public.job_interest ji where ji.booking_id = p_booking_id and ji.provider_id = pp.profile_id)
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where public.provider_can_take(p_booking_id, pp.profile_id, true)
    order by extensions.st_distance(pp.base_location, v_pin), pp.profile_id;
end;
$$;
revoke all on function public.matching_candidates(uuid) from public, anon, authenticated;
grant execute on function public.matching_candidates(uuid) to service_role;

-- Tell every approved provider who declared this service. Runs once per booking.
create or replace function public.alert_matching_providers(p_booking_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_service text;
  v_city text;
  v_notify jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Alerts must use the validated server route' using errcode = '42501';
  end if;
  update public.bookings
  set providers_alerted_at = now()
  where id = p_booking_id and providers_alerted_at is null
    and status = 'open' and not is_urgent and job_class is distinct from 'major'
  returning * into v_booking;
  if not found then return '[]'::jsonb; end if;

  select s.name into v_service from public.services s where s.id = v_booking.service_id;
  select a.city into v_city from public.addresses a where a.id = v_booking.address_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_id', pp.profile_id,
    'event', 'request.new',
    'title', 'A customer is looking for ' || coalesce(v_service, 'a provider'),
    'body', 'A job that matches your skills' || coalesce(' in ' || v_city, '') || ' is open. If you can do it, open it and tap "I can do this".',
    'link', '/provider',
    'channels', jsonb_build_array('in_app', 'email')
  )), '[]'::jsonb) into v_notify
  from public.provider_profiles pp
  where pp.status = 'approved'
    and pp.profile_id <> v_booking.customer_id
    and exists (select 1 from public.provider_services ps where ps.provider_id = pp.profile_id and ps.service_id = v_booking.service_id);
  return v_notify;
end;
$$;
revoke all on function public.alert_matching_providers(uuid) from public, anon, authenticated;
grant execute on function public.alert_matching_providers(uuid) to service_role;

-- What a provider sees: open normal jobs for services they declared.
create or replace function public.open_requests_for_me()
returns table (
  booking_id uuid, service_name text, description text, preferred_start timestamptz,
  barangay text, city text, distance_m double precision, interested boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  return query
    select b.id, s.name, b.description, b.preferred_start, a.barangay, a.city,
      case when a.location is not null and pp.base_location is not null
        then extensions.st_distance(pp.base_location, a.location) end,
      exists (select 1 from public.job_interest ji where ji.booking_id = b.id and ji.provider_id = v_uid),
      b.created_at
    from public.bookings b
    join public.provider_profiles pp on pp.profile_id = v_uid and pp.status = 'approved'
    join public.services s on s.id = b.service_id
    left join public.addresses a on a.id = b.address_id
    where b.status = 'open' and not b.is_urgent and b.job_class is distinct from 'major'
      and b.customer_id <> v_uid
      and exists (select 1 from public.provider_services ps where ps.provider_id = v_uid and ps.service_id = b.service_id)
      and not exists (select 1 from public.offers o where o.booking_id = b.id and o.provider_id = v_uid and o.status in ('declined', 'expired'))
    order by b.created_at desc
    limit 50;
end;
$$;
revoke all on function public.open_requests_for_me() from public, anon;
grant execute on function public.open_requests_for_me() to authenticated;

-- "I can do this" and taking it back.
create or replace function public.set_job_interest(p_booking_id uuid, p_interested boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_service text;
  v_added integer := 0;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;

  if not coalesce(p_interested, false) then
    delete from public.job_interest where booking_id = p_booking_id and provider_id = v_uid;
    return jsonb_build_object('interested', false, 'notify', '[]'::jsonb);
  end if;

  if v_booking.status <> 'open' or v_booking.is_urgent or v_booking.job_class = 'major' then
    raise exception 'This request is no longer open';
  end if;
  if not public.provider_can_take(p_booking_id, v_uid, false) then
    raise exception 'This request does not match the services on your profile';
  end if;

  insert into public.job_interest (booking_id, provider_id) values (p_booking_id, v_uid)
  on conflict do nothing;
  get diagnostics v_added = row_count;
  select s.name into v_service from public.services s where s.id = v_booking.service_id;
  perform public.write_audit(v_uid, 'job.interest', 'bookings', p_booking_id::text, null, '{}'::jsonb);

  return jsonb_build_object('interested', true, 'notify', case when v_added > 0 then jsonb_build_array(jsonb_build_object(
    'profile_id', v_booking.customer_id,
    'event', 'request.interest',
    'title', 'A provider can do your job',
    'body', 'A provider who does ' || coalesce(v_service, 'this service') || ' says they can take it. See them on your list.',
    'link', '/customer/bookings/' || p_booking_id || '/choose',
    'channels', jsonb_build_array('in_app', 'email')
  )) else '[]'::jsonb end);
end;
$$;
revoke all on function public.set_job_interest(uuid, boolean) from public, anon;
grant execute on function public.set_job_interest(uuid, boolean) to authenticated;
