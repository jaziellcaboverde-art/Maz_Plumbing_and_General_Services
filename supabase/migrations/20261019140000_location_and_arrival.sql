-- Phase 4: secure location persistence, provider distance search, arrival checks and overrides.

create table public.arrival_override_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_reason text,
  check ((status = 'pending') = (reviewed_at is null)),
  check ((status = 'pending') = (reviewed_by is null))
);
create index arrival_override_requests_status_idx on public.arrival_override_requests(status, requested_at);
create index arrival_override_requests_booking_id_idx on public.arrival_override_requests(booking_id);
create unique index arrival_override_one_pending_per_booking_idx on public.arrival_override_requests(booking_id) where status = 'pending';
alter table public.arrival_override_requests enable row level security;
grant select on public.arrival_override_requests to authenticated;
create policy "arrival overrides: admin reads" on public.arrival_override_requests
  for select to authenticated using (provider_id = (select auth.uid()) or (select public.is_admin()));

-- Only trusted server code can change the saved coordinates on existing profile/address rows.
revoke update on public.addresses from authenticated;
grant update (label, line1, barangay, city, province, landmark) on public.addresses to authenticated;
-- Earlier grants included base_location; revoke it so providers cannot bypass server-side country checks.
revoke update (base_location) on public.provider_profiles from authenticated;
create function public.save_location_point(p_target text, p_id uuid, p_longitude double precision, p_latitude double precision, p_landmark text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted server code can save a validated location' using errcode = '42501';
  end if;
  if p_longitude is null or p_latitude is null
    or p_longitude < -180 or p_longitude > 180
    or p_latitude < -90 or p_latitude > 90 then
    raise exception 'Enter valid longitude and latitude';
  end if;
  if p_target = 'address' then
    update public.addresses
      set location = extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
          landmark = nullif(btrim(left(coalesce(p_landmark, ''), 300)), '')
      where id = p_id;
  elsif p_target = 'provider' then
    update public.provider_profiles
      set base_location = extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography
      where profile_id = p_id;
  else
    raise exception 'Unsupported location target';
  end if;
  if not found then raise exception 'Location record not found'; end if;
end;
$$;
revoke all on function public.save_location_point(text, uuid, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.save_location_point(text, uuid, double precision, double precision, text) to service_role;

create function public.find_nearby_approved_providers(
  p_longitude double precision,
  p_latitude double precision,
  p_radius_m double precision,
  p_service_id uuid default null
)
returns table (provider_id uuid, first_name text, last_initial text, daily_rate numeric, distance_m double precision)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_origin extensions.geography;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Provider distance search must use the validated server route' using errcode = '42501';
  end if;
  if p_longitude is null or p_latitude is null
    or p_longitude < -180 or p_longitude > 180
    or p_latitude < -90 or p_latitude > 90
    or p_radius_m is null or p_radius_m <= 0 or p_radius_m > 200000 then
    raise exception 'Enter a valid search point and radius';
  end if;
  if p_service_id is not null and not exists (
    select 1 from public.services s where s.id = p_service_id and s.active
  ) then raise exception 'Service not found'; end if;
  v_origin := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  return query
    select pp.profile_id, p.first_name,
      case when nullif(p.last_name, '') is null then '' else left(p.last_name, 1) || '.' end,
      pp.daily_rate,
      extensions.st_distance(pp.base_location, v_origin)
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where pp.status = 'approved'
      and pp.base_location is not null
      and (p_service_id is null or exists (
        select 1 from public.provider_services ps where ps.provider_id = pp.profile_id and ps.service_id = p_service_id
      ))
      and extensions.st_dwithin(pp.base_location, v_origin, p_radius_m)
    order by extensions.st_distance(pp.base_location, v_origin), pp.profile_id;
end;
$$;
revoke all on function public.find_nearby_approved_providers(double precision, double precision, double precision, uuid) from public, anon, authenticated;
grant execute on function public.find_nearby_approved_providers(double precision, double precision, double precision, uuid) to service_role;

create function public.record_provider_arrival(
  p_booking_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_accuracy_m double precision
)
returns table (distance_m double precision, allowed_radius_m double precision, within_radius boolean)
language plpgsql security definer set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_pin extensions.geography;
  v_arrival extensions.geography;
  v_distance double precision;
  v_radius double precision;
begin
  if auth.uid() is null then raise exception 'Sign in to check in'; end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.provider_id <> auth.uid() then
    raise exception 'You cannot check in to this booking' using errcode = '42501';
  end if;
  if v_booking.status <> 'on_the_way' then raise exception 'Check-in is available when the booking is on the way'; end if;
  select a.location into v_pin from public.addresses a where a.id = v_booking.address_id;
  if v_pin is null then raise exception 'The booking does not have a saved map pin'; end if;
  if p_longitude is null or p_latitude is null or p_longitude < -180 or p_longitude > 180 or p_latitude < -90 or p_latitude > 90
    or p_accuracy_m is null or p_accuracy_m < 0 or p_accuracy_m > 100000 then
    raise exception 'GPS returned invalid coordinates';
  end if;
  v_arrival := extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography;
  v_distance := extensions.st_distance(v_pin, v_arrival);
  select (value #>> '{}')::double precision into v_radius from public.config where key = 'arrival.radius_m';
  v_radius := coalesce(v_radius, 200);
  if v_distance <= v_radius then
    insert into public.work_days (booking_id, provider_id, work_date, arrived_at, arrival_location, arrival_distance_m, gps_accuracy_m)
    values (p_booking_id, auth.uid(), (now() at time zone 'Asia/Manila')::date, now(), v_arrival, v_distance, p_accuracy_m)
    on conflict (booking_id, work_date) do update set
      arrived_at = excluded.arrived_at, arrival_location = excluded.arrival_location,
      arrival_distance_m = excluded.arrival_distance_m, gps_accuracy_m = excluded.gps_accuracy_m;
  end if;
  return query select v_distance, v_radius, v_distance <= v_radius;
end;
$$;
revoke all on function public.record_provider_arrival(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_provider_arrival(uuid, double precision, double precision, double precision) to authenticated;

create function public.request_arrival_override(p_booking_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_request_id uuid;
begin
  if auth.uid() is null or length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Explain why GPS check-in failed (at least 10 characters)';
  end if;
  if not exists (
    select 1 from public.bookings b where b.id = p_booking_id and b.provider_id = auth.uid() and b.status = 'on_the_way'
  ) then raise exception 'You cannot request an override for this booking' using errcode = '42501'; end if;
  insert into public.arrival_override_requests (booking_id, provider_id, reason)
  values (p_booking_id, auth.uid(), btrim(p_reason)) returning id into v_request_id;
  return v_request_id;
end;
$$;
revoke all on function public.request_arrival_override(uuid, text) from public, anon;
grant execute on function public.request_arrival_override(uuid, text) to authenticated;

create function public.review_arrival_override(p_request_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_request public.arrival_override_requests%rowtype;
begin
  if not public.is_admin() then raise exception 'Only admins can review arrival overrides' using errcode = '42501'; end if;
  select * into v_request from public.arrival_override_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then raise exception 'This override request is no longer pending'; end if;
  if not p_approve and length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Give a reason for declining the override';
  end if;
  update public.arrival_override_requests set
    status = case when p_approve then 'approved' else 'declined' end,
    reviewed_at = now(), reviewed_by = auth.uid(), review_reason = nullif(btrim(p_reason), '')
  where id = p_request_id;
  if p_approve then
    insert into public.work_days (booking_id, provider_id, work_date, arrived_at, admin_override, override_reason)
    values (v_request.booking_id, v_request.provider_id, (now() at time zone 'Asia/Manila')::date, now(), true, v_request.reason)
    on conflict (booking_id, work_date) do update set arrived_at = excluded.arrived_at,
      admin_override = true, override_reason = excluded.override_reason;
  end if;
  perform public.write_audit(auth.uid(), 'arrival_override.review', 'arrival_override_requests', p_request_id::text,
    coalesce(nullif(btrim(p_reason), ''), v_request.reason), jsonb_build_object('approved', p_approve, 'provider_id', v_request.provider_id));
end;
$$;
revoke all on function public.review_arrival_override(uuid, boolean, text) from public, anon;
grant execute on function public.review_arrival_override(uuid, boolean, text) to authenticated;
