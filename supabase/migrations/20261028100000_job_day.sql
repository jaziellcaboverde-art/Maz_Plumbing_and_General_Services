-- Phase 10, steps 10.1 to 10.4 and 10.2a: schedule, on the way, live map, daily check in, close the day.

alter table public.bookings
  add column if not exists scheduled_start timestamptz,
  add column if not exists schedule_confirmed_at timestamptz,
  add column if not exists reminder_sent_at timestamptz,
  add column if not exists travel_started_at timestamptz;

alter table public.work_days
  add column if not exists close_photo_paths text[] not null default '{}',
  add column if not exists close_note text;

-- ---------------------------------------------------------------------------------------------
-- 10.2a: the provider's current spot while on the way. One row per booking, no trail.
-- Only the booking's customer can read it. It is deleted the moment the booking leaves on_the_way
-- (check in, cancel, anything else).

create table public.live_locations (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m double precision check (accuracy_m is null or accuracy_m >= 0),
  updated_at timestamptz not null default now()
);
alter table public.live_locations enable row level security;
grant select on public.live_locations to authenticated;
create policy "live_locations: the customer of that booking reads" on public.live_locations
  for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id and b.customer_id = (select auth.uid())));

create or replace function public.clear_live_location_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'on_the_way' and new.status <> 'on_the_way' then
    delete from public.live_locations where booking_id = new.id;
  end if;
  return null;
end;
$$;
create trigger bookings_clear_live_location after update of status on public.bookings
  for each row execute function public.clear_live_location_on_status_change();

-- ---------------------------------------------------------------------------------------------
-- 10.1: the provider confirms the day and time. The customer is told. A reminder goes out later.

create or replace function public.confirm_schedule(p_booking_id uuid, p_start timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status not in ('deposit_paid', 'scheduled') then
    raise exception 'You can set the schedule after the customer pays the deposit' using errcode = 'P0001';
  end if;
  if p_start is null or p_start <= now() then
    raise exception 'Pick a day and time in the future' using errcode = 'P0001';
  end if;

  update public.bookings
    set scheduled_start = p_start, schedule_confirmed_at = now(), reminder_sent_at = null
    where id = p_booking_id;
  if v_booking.status = 'deposit_paid' then
    perform public.change_booking_status(p_booking_id, 'scheduled', 'Schedule confirmed');
  end if;
  perform public.write_audit(v_uid, 'schedule.confirmed', 'bookings', p_booking_id::text, null,
    jsonb_build_object('start', p_start, 'rescheduled', v_booking.status = 'scheduled'));

  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'schedule.confirmed',
      'title', case when v_booking.status = 'scheduled' then 'Your job time changed' else 'Your job is scheduled' end,
      'body', 'Your provider will come on ' || to_char(p_start at time zone 'Asia/Manila', 'FMDay, FMMonth DD "at" HH12:MI AM') || '.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
revoke all on function public.confirm_schedule(uuid, timestamptz) from public, anon;
grant execute on function public.confirm_schedule(uuid, timestamptz) to authenticated;

-- Reminders: the worker calls this. Each booking is reminded once, inside the reminder window.
create or replace function public.send_schedule_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hours numeric := public.cfg_number('schedule.reminder_hours', 24);
  v_notify jsonb := '[]'::jsonb;
  v_row record;
begin
  if auth.role() <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  for v_row in
    update public.bookings
      set reminder_sent_at = now()
      where status = 'scheduled' and reminder_sent_at is null
        and scheduled_start > now() and scheduled_start <= now() + make_interval(hours => v_hours::int)
      returning id, customer_id, provider_id, scheduled_start
  loop
    v_notify := v_notify
      || jsonb_build_object('profile_id', v_row.customer_id, 'event', 'schedule.reminder',
           'title', 'Your job is coming up',
           'body', 'Your provider is scheduled for ' || to_char(v_row.scheduled_start at time zone 'Asia/Manila', 'FMDay, FMMonth DD "at" HH12:MI AM') || '.',
           'link', '/customer/bookings/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email'))
      || jsonb_build_object('profile_id', v_row.provider_id, 'event', 'schedule.reminder',
           'title', 'A job is coming up',
           'body', 'You are scheduled for ' || to_char(v_row.scheduled_start at time zone 'Asia/Manila', 'FMDay, FMMonth DD "at" HH12:MI AM') || '.',
           'link', '/provider/jobs/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email'));
  end loop;
  return v_notify;
end;
$$;
revoke all on function public.send_schedule_reminders() from public, anon, authenticated;
grant execute on function public.send_schedule_reminders() to service_role;

-- ---------------------------------------------------------------------------------------------
-- 10.2: On the way. From here the customer cannot cancel (the status moves already say so).

create or replace function public.start_travel(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'scheduled' then
    raise exception 'Confirm the schedule first' using errcode = 'P0001';
  end if;
  if (now() at time zone 'Asia/Manila')::date < (v_booking.scheduled_start at time zone 'Asia/Manila')::date then
    raise exception 'You can tap On the way on the day of the job' using errcode = 'P0001';
  end if;
  perform public.change_booking_status(p_booking_id, 'on_the_way', 'Provider on the way');
  update public.bookings set travel_started_at = now() where id = p_booking_id;
  perform public.write_audit(v_uid, 'travel.started', 'bookings', p_booking_id::text, null, '{}'::jsonb);
  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'travel.started',
      'title', 'Your provider is on the way', 'body', 'You can follow their location on your booking.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
revoke all on function public.start_travel(uuid) from public, anon;
grant execute on function public.start_travel(uuid) to authenticated;

-- 10.2a: the provider's phone sends its position. Only while on the way. Replaces the old spot.
create or replace function public.update_live_location(
  p_booking_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy_m double precision default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if p_latitude is null or p_longitude is null or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'GPS returned invalid coordinates' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.bookings where id = p_booking_id and provider_id = v_uid and status = 'on_the_way') then
    raise exception 'Location sharing is only on while you are on the way' using errcode = '42501';
  end if;
  insert into public.live_locations (booking_id, provider_id, latitude, longitude, accuracy_m, updated_at)
  values (p_booking_id, v_uid, p_latitude, p_longitude, p_accuracy_m, now())
  on conflict (booking_id) do update
    set latitude = excluded.latitude, longitude = excluded.longitude,
        accuracy_m = excluded.accuracy_m, updated_at = now();
end;
$$;
revoke all on function public.update_live_location(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.update_live_location(uuid, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 10.3: daily check in with the 200 m rule. Same as before, plus: it also works on later work
-- days (in_progress), and the first good check in moves the booking to in_progress.

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
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or v_booking.provider_id <> auth.uid() then
    raise exception 'You cannot check in to this booking' using errcode = '42501';
  end if;
  if v_booking.status not in ('on_the_way', 'in_progress') then
    raise exception 'Check-in is available when the booking is on the way or in progress';
  end if;
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
      arrival_distance_m = excluded.arrival_distance_m, gps_accuracy_m = excluded.gps_accuracy_m
      where public.work_days.closed_at is null;
    if v_booking.status = 'on_the_way' then
      perform public.change_booking_status(p_booking_id, 'in_progress', 'Provider checked in');
    end if;
    perform public.write_audit(auth.uid(), 'work_day.checked_in', 'bookings', p_booking_id::text, null,
      jsonb_build_object('distance_m', v_distance));
  end if;
  return query select v_distance, v_radius, v_distance <= v_radius;
end;
$$;
revoke all on function public.record_provider_arrival(uuid, double precision, double precision, double precision) from public, anon;
grant execute on function public.record_provider_arrival(uuid, double precision, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 10.4: end of day. The provider closes today's work day with at least one photo.

create or replace function public.close_work_day(p_booking_id uuid, p_photo_paths text[], p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_day public.work_days%rowtype;
  v_path text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and provider_id = v_uid;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'in_progress' then
    raise exception 'You can close a work day while the job is in progress' using errcode = 'P0001';
  end if;
  select * into v_day from public.work_days
    where booking_id = p_booking_id and work_date = (now() at time zone 'Asia/Manila')::date for update;
  if not found or v_day.arrived_at is null then
    raise exception 'Check in today before you close the day' using errcode = 'P0001';
  end if;
  if v_day.closed_at is not null then
    raise exception 'Today is already closed' using errcode = 'P0001';
  end if;
  if p_photo_paths is null or cardinality(p_photo_paths) < 1 or cardinality(p_photo_paths) > 10 then
    raise exception 'Add 1 to 10 photos of the work done today' using errcode = 'P0001';
  end if;
  foreach v_path in array p_photo_paths loop
    if v_path is null or left(v_path, 37) <> p_booking_id::text || '/' then
      raise exception 'A photo does not belong to this booking' using errcode = 'P0001';
    end if;
  end loop;

  update public.work_days
    set closed_at = now(), close_photo_paths = p_photo_paths, close_note = nullif(left(btrim(coalesce(p_note, '')), 1000), '')
    where id = v_day.id;
  perform public.write_audit(v_uid, 'work_day.closed', 'bookings', p_booking_id::text, null,
    jsonb_build_object('work_date', v_day.work_date, 'photos', cardinality(p_photo_paths)));
  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'work_day.closed',
      'title', 'Today''s work is finished', 'body', 'Your provider added photos of today''s work.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app'))));
end;
$$;
revoke all on function public.close_work_day(uuid, text[], text) from public, anon;
grant execute on function public.close_work_day(uuid, text[], text) to authenticated;
