-- Provider accounts receive the provider role during signup, but are not providers
-- for authorization purposes until an administrator approves their application.

create or replace function public.register_provider_applicant(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Only trusted server code can register a provider applicant' using errcode = '42501';
  end if;

  update public.profiles
  set role = 'provider'
  where id = p_user_id and role = 'customer';
  v_changed := found;

  if not v_changed and not exists (
    select 1 from public.profiles where id = p_user_id and role = 'provider'
  ) then
    raise exception 'A provider applicant profile could not be found' using errcode = 'P0002';
  end if;

  if v_changed then
    perform public.write_audit(
      p_user_id, 'provider.signup', 'profiles', p_user_id::text, null,
      jsonb_build_object('role', 'provider', 'authorization', 'pending_admin_approval')
    );
  end if;
end;
$$;
revoke all on function public.register_provider_applicant(uuid) from public, anon, authenticated;
grant execute on function public.register_provider_applicant(uuid) to service_role;

create or replace function public.is_provider_applicant()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        (p.role = 'provider' and not exists (
          select 1 from public.provider_profiles pp
          where pp.profile_id = p.id and pp.status = 'approved'
        ))
        or (p.role = 'customer' and exists (
          select 1 from public.provider_profiles pp
          where pp.profile_id = p.id and pp.status in ('pending', 'rejected')
        ))
      )
  )
$$;

create or replace function public.is_approved_provider()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = auth.uid() and pp.status = 'approved' and p.role = 'provider'
  )
$$;

create or replace function public.is_booking_provider(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_approved_provider()
    and exists (select 1 from public.bookings b where b.id = p_booking and b.provider_id = auth.uid())
$$;

create or replace function public.has_offer_on(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_approved_provider()
    and exists (
      select 1 from public.offers o
      where o.booking_id = p_booking and o.provider_id = auth.uid()
    )
$$;

create or replace function public.is_payout_owner(p_payout uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_approved_provider()
    and exists (select 1 from public.payouts po where po.id = p_payout and po.provider_id = auth.uid())
$$;

drop policy if exists "bookings: read as customer, provider, offered provider or admin" on public.bookings;
create policy "bookings: read as customer, provider, offered provider or admin" on public.bookings
  for select to authenticated
  using (
    (customer_id = (select auth.uid()) and not (select public.is_provider_applicant()))
    or (provider_id = (select auth.uid()) and (select public.is_approved_provider()))
    or (select public.has_offer_on(id))
    or (select public.is_admin())
  );

drop policy if exists "addresses: read own, admin, or the accepted provider" on public.addresses;
create policy "addresses: read own, admin, or the accepted provider" on public.addresses
  for select to authenticated
  using (
    (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()))
    or (select public.is_admin())
    or (
      (select public.is_approved_provider())
      and exists (
        select 1 from public.bookings b
        where b.address_id = addresses.id and b.provider_id = (select auth.uid())
      )
    )
  );

drop policy if exists "offers: read as the provider, the customer or admin" on public.offers;
create policy "offers: read as the provider, the customer or admin" on public.offers
  for select to authenticated
  using (
    (provider_id = (select auth.uid()) and (select public.is_approved_provider()))
    or (select public.is_booking_customer(booking_id))
    or (select public.is_admin())
  );

drop policy if exists "job interest: read as the provider, the customer or admin" on public.job_interest;
create policy "job interest: read as the provider, the customer or admin" on public.job_interest
  for select to authenticated
  using (
    (provider_id = (select auth.uid()) and (select public.is_approved_provider()))
    or public.is_admin()
    or public.is_booking_customer(booking_id)
  );

drop policy if exists "payouts: read own or admin" on public.payouts;
create policy "payouts: read own or admin" on public.payouts
  for select to authenticated
  using ((provider_id = (select auth.uid()) and (select public.is_approved_provider())) or (select public.is_admin()));

create or replace function public.change_booking_status(
  p_booking_id uuid,
  p_to public.booking_status,
  p_reason text default null
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_actors text[];
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_actor text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  select m.actors into v_actors
  from public.booking_status_moves m
  where m.from_status = v_booking.status and m.to_status = p_to;
  if v_actors is null then
    raise exception 'A booking cannot move from % to %', v_booking.status, p_to using errcode = 'P0001';
  end if;

  if v_uid is null then
    if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', '') <> 'service_role'
       and coalesce(current_setting('role', true), '') <> 'service_role' then
      raise exception 'Sign in first' using errcode = '42501';
    end if;
    v_actor := 'system';
  else
    select p.role into v_role from public.profiles p where p.id = v_uid;
    v_actor := case
      when v_role = 'admin' then 'admin'
      when v_role = 'customer' and v_booking.customer_id = v_uid
        and not public.is_provider_applicant() then 'customer'
      when v_role = 'provider' and public.is_approved_provider() and (
        v_booking.provider_id = v_uid
        or v_booking.picked_provider_id = v_uid
        or exists (
          select 1 from public.offers o
          where o.booking_id = v_booking.id and o.provider_id = v_uid and o.status = 'pending'
        )
      ) then 'provider'
      else null
    end;
  end if;

  if v_actor is null or not (v_actor = any (v_actors)) then
    raise exception 'You cannot make this change' using errcode = '42501';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.bookings
  set status = p_to,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
      cancel_reason = case when p_to = 'cancelled' then p_reason else cancel_reason end
  where id = p_booking_id;
  perform set_config('app.status_change', 'off', true);

  perform public.write_audit(
    v_uid, 'booking.status', 'bookings', p_booking_id::text, p_reason,
    jsonb_build_object('from', v_booking.status, 'to', p_to, 'actor', v_actor)
  );
  return p_to;
end;
$$;
revoke all on function public.change_booking_status(uuid, public.booking_status, text) from public, anon;
grant execute on function public.change_booking_status(uuid, public.booking_status, text) to authenticated, service_role;

create or replace function public.mark_booking_site_inspected(p_booking_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_actor text;
  v_inspected_at timestamptz;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  if v_uid is null then
    if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', '') <> 'service_role'
       and coalesce(current_setting('role', true), '') <> 'service_role' then
      raise exception 'Sign in first' using errcode = '42501';
    end if;
    v_actor := 'system';
  else
    select p.role into v_role from public.profiles p where p.id = v_uid;
    v_actor := case
      when v_role = 'admin' then 'admin'
      when v_role = 'provider' and public.is_approved_provider()
        and (v_booking.provider_id = v_uid or v_booking.picked_provider_id = v_uid) then 'provider'
      else null
    end;

    if v_actor is null then
      raise exception 'Only the assigned provider or an admin can record site inspection'
        using errcode = '42501';
    end if;
  end if;

  update public.bookings
  set site_inspected_at = coalesce(site_inspected_at, now())
  where id = p_booking_id
  returning site_inspected_at into v_inspected_at;

  perform public.write_audit(
    v_uid, 'booking.site_inspected', 'bookings', p_booking_id::text, null,
    jsonb_build_object('actor', v_actor, 'site_inspected_at', v_inspected_at)
  );
  return v_inspected_at;
end;
$$;
revoke all on function public.mark_booking_site_inspected(uuid) from public, anon;
grant execute on function public.mark_booking_site_inspected(uuid) to authenticated, service_role;

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
  if not public.is_approved_provider() then raise exception 'Your provider account is not approved' using errcode = '42501'; end if;
  select * into v_offer from public.offers where id = p_offer_id and provider_id = v_uid for update;
  if not found then raise exception 'Offer not found' using errcode = 'P0002'; end if;
  if v_offer.status <> 'pending' then raise exception 'This offer is no longer open'; end if;
  select * into v_booking from public.bookings where id = v_offer.booking_id for update;

  if v_offer.expires_at <= now() then
    v_next := public.register_offer_miss(p_offer_id, 'expired', 'No answer in time');
    return jsonb_build_object('outcome', 'expired', 'next', v_next, 'booking_id', v_offer.booking_id, 'notify', '[]'::jsonb);
  end if;

  if p_accept then
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
  if not public.is_approved_provider() then raise exception 'Your provider account is not approved' using errcode = '42501'; end if;
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

create or replace function public.record_provider_arrival(
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
  if not public.is_approved_provider() then raise exception 'Your provider account is not approved' using errcode = '42501'; end if;
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

create or replace function public.request_arrival_override(p_booking_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_request_id uuid;
begin
  if auth.uid() is null or length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'Explain why GPS check-in failed (at least 10 characters)';
  end if;
  if not public.is_approved_provider() or not exists (
    select 1 from public.bookings b where b.id = p_booking_id and b.provider_id = auth.uid() and b.status = 'on_the_way'
  ) then raise exception 'You cannot request an override for this booking' using errcode = '42501'; end if;
  insert into public.arrival_override_requests (booking_id, provider_id, reason)
  values (p_booking_id, auth.uid(), btrim(p_reason)) returning id into v_request_id;
  return v_request_id;
end;
$$;

create or replace function public.chat_unread_counts()
returns table (booking_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.booking_id, count(*)::bigint
  from public.messages m
  left join public.message_reads r on r.booking_id = m.booking_id and r.profile_id = auth.uid()
  where auth.uid() is not null
    and (public.is_booking_customer(m.booking_id) or public.is_booking_provider(m.booking_id))
    and m.sender_id <> auth.uid()
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
  group by m.booking_id
$$;
