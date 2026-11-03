-- Provider prerequisites missing from the deployed database.
-- Consolidated under a unique version because the old timestamps collide with service migrations.

-- Source: 20261029100000_provider_availability.sql
-- Provider availability is separate from bookings so changing availability never
-- mutates or cancels an existing assignment.

create table public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'available' check (kind in ('available', 'unavailable')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '31 days')
);

create index provider_availability_provider_time_idx
  on public.provider_availability (provider_id, starts_at, ends_at);
create trigger provider_availability_set_updated_at before update
  on public.provider_availability for each row execute function public.set_updated_at();

alter table public.provider_availability enable row level security;
grant select, insert, update, delete on public.provider_availability to authenticated;

create policy "provider availability: provider owns rows" on public.provider_availability
  for all to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()))
  with check (provider_id = (select auth.uid()) or (select public.is_admin()));

create or replace function public.save_provider_availability(
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_kind text default 'available',
  p_note text default null
)
returns public.provider_availability
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.provider_availability;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.provider_profiles
    where profile_id = v_uid and status = 'approved'
  ) then
    raise exception 'Approved provider access required' using errcode = '42501';
  end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then
    raise exception 'End time must be after start time';
  end if;
  if p_ends_at - p_starts_at > interval '31 days' then
    raise exception 'Availability cannot span more than 31 days';
  end if;
  if p_kind not in ('available', 'unavailable') then
    raise exception 'Choose available or unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  if exists (
    select 1 from public.provider_availability
    where provider_id = v_uid
      and tstzrange(starts_at, ends_at, '[)') && tstzrange(p_starts_at, p_ends_at, '[)')
  ) then
    raise exception 'This time overlaps an existing availability entry';
  end if;
  if p_kind = 'available' and exists (
    select 1 from public.bookings
    where provider_id = v_uid
      and status in ('accepted','quoted','deposit_paid','scheduled','on_the_way','in_progress')
      and scheduled_start is not null
      and scheduled_start >= p_starts_at
      and scheduled_start < p_ends_at
  ) then
    raise exception 'This period overlaps a confirmed job';
  end if;

  insert into public.provider_availability(provider_id, starts_at, ends_at, kind, note)
  values (v_uid, p_starts_at, p_ends_at, p_kind, nullif(left(btrim(coalesce(p_note, '')), 300), ''))
  returning * into v_row;
  perform public.write_audit(v_uid, 'provider.availability_saved', 'provider_availability', v_row.id::text, null,
    jsonb_build_object('starts_at', p_starts_at, 'ends_at', p_ends_at, 'kind', p_kind));
  return v_row;
end;
$$;

revoke all on function public.save_provider_availability(timestamptz, timestamptz, text, text)
  from public, anon;
grant execute on function public.save_provider_availability(timestamptz, timestamptz, text, text)
  to authenticated;


-- Source: 20261029110000_provider_completion.sql
create table public.provider_completions (
  booking_id uuid primary key references public.bookings (id) on delete restrict,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  notes text not null check (length(btrim(notes)) >= 10),
  photo_paths text[] not null check (cardinality(photo_paths) between 1 and 10),
  submitted_at timestamptz not null default now()
);

alter table public.provider_completions enable row level security;
grant select on public.provider_completions to authenticated;
create policy "provider completions: assigned provider or admin reads"
  on public.provider_completions for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));

create trigger provider_completions_no_change before update or delete
  on public.provider_completions for each row execute function public.block_row_change();

create or replace function public.submit_provider_completion(
  p_booking_id uuid, p_notes text, p_photo_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_path text;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings
    where id = p_booking_id and provider_id = v_uid for update;
  if not found then raise exception 'You cannot complete this booking' using errcode = '42501'; end if;
  if v_booking.status <> 'in_progress' then
    raise exception 'The job must be in progress before it can be completed';
  end if;
  if length(btrim(coalesce(p_notes, ''))) < 10 then
    raise exception 'Add completion notes of at least 10 characters';
  end if;
  if p_photo_paths is null or cardinality(p_photo_paths) not between 1 and 10 then
    raise exception 'Add 1 to 10 completion photos';
  end if;
  foreach v_path in array p_photo_paths loop
    if v_path is null or left(v_path, 37) <> p_booking_id::text || '/' then
      raise exception 'A completion photo does not belong to this booking';
    end if;
  end loop;
  insert into public.provider_completions(booking_id, provider_id, notes, photo_paths)
  values (p_booking_id, v_uid, left(btrim(p_notes), 2000), p_photo_paths);
  perform public.change_booking_status(p_booking_id, 'done', 'Provider submitted completion');
  perform public.write_audit(v_uid, 'provider.completion_submitted', 'bookings', p_booking_id::text, null,
    jsonb_build_object('photos', cardinality(p_photo_paths)));
  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'job.completed',
      'title', 'Your provider marked the job done', 'body', 'Review the completion and next steps in your booking.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
revoke all on function public.submit_provider_completion(uuid, text, text[]) from public, anon;
grant execute on function public.submit_provider_completion(uuid, text, text[]) to authenticated;


-- Source: 20261029120000_provider_assignment_availability.sql
-- Extend the existing eligibility function. Recommendations remain advisory;
-- this function is the authoritative availability and overlap filter.
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
      and not exists (
        select 1 from public.provider_availability pa
        where pa.provider_id = p_provider_id and pa.kind = 'unavailable'
          and b.preferred_start is not null
          and tstzrange(pa.starts_at, pa.ends_at, '[)')
            && tstzrange(b.preferred_start, b.preferred_start + interval '1 hour', '[)')
      )
      and not exists (
        select 1 from public.bookings existing
        where existing.provider_id = p_provider_id
          and existing.id <> b.id
          and existing.status in ('accepted','quoted','deposit_paid','scheduled','on_the_way','in_progress')
          and existing.scheduled_start is not null
          and b.preferred_start is not null
          and tstzrange(existing.scheduled_start, existing.scheduled_start + interval '1 hour', '[)')
            && tstzrange(b.preferred_start, b.preferred_start + interval '1 hour', '[)')
      )
      and (
        not p_check_distance
        or exists (
          select 1 from public.addresses a
          where a.id = b.address_id and a.location is not null and pp.base_location is not null
            and extensions.st_dwithin(pp.base_location, a.location, public.cfg_number('ranking.max_distance_km', 15) * 1000)
        )
      )
      and (
        not p_check_distance
        or not (b.job_class = 'major' or b.is_major_renovation)
        or (select count(*) from public.bookings fb where fb.provider_id = p_provider_id
              and fb.status in ('done', 'signed', 'balance_paid', 'completed'))
           >= public.cfg_number('probation.large_job_min_finished', 3)
      )
  )
$$;
revoke all on function public.provider_can_take(uuid, uuid, boolean) from public, anon, authenticated;


-- Source: 20261029130000_provider_schedule_reminders.sql
-- Replace the previous single reminder marker with independent one-day and
-- two-hour markers. Rescheduling clears both markers in confirm_schedule.
alter table public.bookings
  add column if not exists reminder_day_sent_at timestamptz,
  add column if not exists reminder_two_hour_sent_at timestamptz;

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
  if v_booking.status not in ('deposit_paid', 'scheduled') then raise exception 'You can set the schedule after the customer pays the deposit'; end if;
  if p_start is null or p_start <= now() then raise exception 'Pick a day and time in the future'; end if;
  update public.bookings set scheduled_start = p_start, schedule_confirmed_at = now(),
    reminder_sent_at = null, reminder_day_sent_at = null, reminder_two_hour_sent_at = null
    where id = p_booking_id;
  if v_booking.status = 'deposit_paid' then perform public.change_booking_status(p_booking_id, 'scheduled', 'Schedule confirmed'); end if;
  perform public.write_audit(v_uid, 'schedule.confirmed', 'bookings', p_booking_id::text, null, jsonb_build_object('start', p_start));
  return jsonb_build_object('booking_id', p_booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'schedule.confirmed', 'title', 'Your job is scheduled',
      'body', 'Your provider will come on ' || to_char(p_start at time zone 'Asia/Manila', 'FMDay, FMMonth DD "at" HH12:MI AM') || '.',
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
grant execute on function public.confirm_schedule(uuid, timestamptz) to authenticated;

create or replace function public.send_schedule_reminders()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_row record;
begin
  if auth.role() <> 'service_role' then raise exception 'Server only' using errcode = '42501'; end if;
  for v_row in
    select * from public.bookings
    where status = 'scheduled' and scheduled_start > now()
      and ((reminder_day_sent_at is null and scheduled_start <= now() + interval '24 hours')
        or (reminder_two_hour_sent_at is null and scheduled_start <= now() + interval '2 hours'))
    for update
  loop
    if v_row.reminder_day_sent_at is null and v_row.scheduled_start <= now() + interval '24 hours' then
      update public.bookings set reminder_day_sent_at = now() where id = v_row.id;
      v_out := v_out || jsonb_build_array(
        jsonb_build_object('profile_id', v_row.customer_id, 'event', 'schedule.reminder.day', 'title', 'Your job is tomorrow', 'body', 'Your scheduled job is tomorrow.', 'link', '/customer/bookings/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email')),
        jsonb_build_object('profile_id', v_row.provider_id, 'event', 'schedule.reminder.day', 'title', 'A job is tomorrow', 'body', 'You are scheduled for a job tomorrow.', 'link', '/provider/jobs/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email')));
    end if;
    if v_row.reminder_two_hour_sent_at is null and v_row.scheduled_start <= now() + interval '2 hours' then
      update public.bookings set reminder_two_hour_sent_at = now() where id = v_row.id;
      v_out := v_out || jsonb_build_array(
        jsonb_build_object('profile_id', v_row.customer_id, 'event', 'schedule.reminder.two_hour', 'title', 'Your job starts in two hours', 'body', 'Your scheduled job starts in about two hours.', 'link', '/customer/bookings/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email')),
        jsonb_build_object('profile_id', v_row.provider_id, 'event', 'schedule.reminder.two_hour', 'title', 'Your job starts in two hours', 'body', 'Your scheduled job starts in about two hours.', 'link', '/provider/jobs/' || v_row.id, 'channels', jsonb_build_array('in_app', 'email')));
    end if;
  end loop;
  return v_out;
end;
$$;
revoke all on function public.send_schedule_reminders() from public, anon, authenticated;
grant execute on function public.send_schedule_reminders() to service_role;
