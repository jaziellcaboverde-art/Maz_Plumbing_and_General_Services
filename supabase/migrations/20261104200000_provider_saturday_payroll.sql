create table public.payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  week_ending date not null check (extract(dow from week_ending) = 6),
  day_count integer not null default 0 check (day_count >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  method public.payout_method not null,
  status public.payout_status not null default 'pending',
  reference text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (provider_id, week_ending)
);

alter table public.payout_batches enable row level security;
grant select on public.payout_batches to authenticated;
create policy "payout batches: provider or admin reads"
  on public.payout_batches for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));

alter table public.payouts
  add column work_day_id uuid references public.work_days(id) on delete restrict,
  add column batch_id uuid references public.payout_batches(id) on delete restrict;
create unique index payouts_work_day_id_unique
  on public.payouts(work_day_id) where work_day_id is not null;

alter table public.work_days
  drop constraint work_days_booking_id_work_date_key;
alter table public.work_days
  add constraint work_days_booking_provider_date_key
  unique (booking_id, provider_id, work_date);

create or replace function public.provider_slot_available(
  p_provider uuid, p_booking uuid, p_start timestamptz, p_end timestamptz, p_buffer integer default 30
)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_start is not null and p_end > p_start
  and exists (select 1 from public.provider_profiles pp join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = p_provider and pp.status = 'approved' and p.role = 'provider')
  and not exists (select 1 from public.provider_availability a where a.provider_id = p_provider and a.kind = 'unavailable'
    and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(p_start, p_end, '[)'))
  and (not exists (select 1 from public.provider_weekly_hours where provider_id = p_provider)
    or not exists (
      select 1 from generate_series((p_start at time zone 'Asia/Manila')::date::timestamp,
        (p_end at time zone 'Asia/Manila')::date::timestamp,interval '1 day') as work_date(day)
      where not exists(select 1 from public.provider_weekly_hours h where h.provider_id=p_provider
        and h.weekday=extract(dow from work_date.day)
        and (work_date.day::date<>(p_start at time zone 'Asia/Manila')::date or (p_start at time zone 'Asia/Manila')::time>=h.starts_at)
        and (work_date.day::date<>(p_end at time zone 'Asia/Manila')::date or (p_end at time zone 'Asia/Manila')::time<=h.ends_at)))
    or exists (select 1 from public.provider_availability a where a.provider_id = p_provider and a.kind = 'available'
      and a.starts_at <= p_start and a.ends_at >= p_end))
  and not exists (select 1 from public.provider_assignments a where a.provider_id = p_provider and a.booking_id <> p_booking
    and (a.status in ('accepted','withdrawal_requested') or (a.status = 'offered' and a.expires_at > now()))
    and (a.starts_at at time zone 'Asia/Manila')::date <= ((p_end - interval '1 microsecond') at time zone 'Asia/Manila')::date
    and ((a.ends_at - interval '1 microsecond') at time zone 'Asia/Manila')::date >= (p_start at time zone 'Asia/Manila')::date)
  and not exists (select 1 from public.bookings b where b.provider_id = p_provider and b.id <> p_booking
    and b.status in ('accepted','quoted','deposit_paid','scheduled','on_the_way','in_progress')
    and coalesce(b.scheduled_start, b.preferred_start) is not null
    and (coalesce(b.scheduled_start,b.preferred_start) at time zone 'Asia/Manila')::date
      <= ((p_end - interval '1 microsecond') at time zone 'Asia/Manila')::date
    and ((coalesce(b.scheduled_start,b.preferred_start) + interval '1 hour' - interval '1 microsecond')
      at time zone 'Asia/Manila')::date >= (p_start at time zone 'Asia/Manila')::date)
  and not exists (select 1 from public.offers o join public.bookings b on b.id = o.booking_id
    where o.provider_id = p_provider and o.booking_id <> p_booking and o.status = 'pending' and o.expires_at > now()
      and (coalesce(b.scheduled_start,b.preferred_start) at time zone 'Asia/Manila')::date
        <= ((p_end - interval '1 microsecond') at time zone 'Asia/Manila')::date
      and ((coalesce(b.scheduled_start,b.preferred_start) + interval '1 hour' - interval '1 microsecond')
        at time zone 'Asia/Manila')::date >= (p_start at time zone 'Asia/Manila')::date)
$$;

create or replace function public.record_provider_arrival(
  p_booking_id uuid,
  p_longitude double precision,
  p_latitude double precision,
  p_accuracy_m double precision
)
returns table (distance_m double precision, allowed_radius_m double precision, within_radius boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_pin extensions.geography;
  v_arrival extensions.geography;
  v_distance double precision;
  v_radius double precision;
  v_work_date date := (now() at time zone 'Asia/Manila')::date;
begin
  if auth.uid() is null then raise exception 'Sign in to check in'; end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found or not (
    v_booking.provider_id = auth.uid()
    or exists (select 1 from public.provider_assignments a where a.booking_id = p_booking_id
      and a.provider_id = auth.uid() and a.phase = 'execution' and a.status in ('accepted','withdrawal_requested'))
  ) then
    raise exception 'You cannot check in to this booking' using errcode = '42501';
  end if;
  if v_booking.status not in ('on_the_way', 'in_progress') then
    raise exception 'Check-in is available when the booking is on the way or in progress';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(auth.uid()::text || ':' || v_work_date::text, 0)
  );
  if exists (select 1 from public.work_days w where w.provider_id = auth.uid()
      and w.work_date = v_work_date and w.booking_id <> p_booking_id) then
    raise exception 'Providers can work on only one booking per day';
  end if;
  if exists (select 1 from public.work_days w where w.provider_id = auth.uid()
      and w.work_date = v_work_date and w.booking_id = p_booking_id and w.closed_at is not null) then
    raise exception 'Today is already closed';
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
    values (p_booking_id, auth.uid(), v_work_date, now(), v_arrival, v_distance, p_accuracy_m)
    on conflict (booking_id, provider_id, work_date) do update set
      arrived_at = excluded.arrived_at, arrival_location = excluded.arrival_location,
      arrival_distance_m = excluded.arrival_distance_m, gps_accuracy_m = excluded.gps_accuracy_m
      where public.work_days.closed_at is null;
    if v_booking.status = 'on_the_way' and v_booking.provider_id = auth.uid() then
      perform public.change_booking_status(p_booking_id, 'in_progress', 'Provider checked in');
    end if;
    perform public.write_audit(auth.uid(), 'work_day.checked_in', 'bookings', p_booking_id::text, null,
      jsonb_build_object('distance_m', v_distance));
  end if;
  return query select v_distance, v_radius, v_distance <= v_radius;
end;
$$;

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
  select * into v_booking from public.bookings where id = p_booking_id and (
    provider_id = v_uid or exists (select 1 from public.provider_assignments a where a.booking_id = p_booking_id
      and a.provider_id = v_uid and a.phase = 'execution' and a.status in ('accepted','withdrawal_requested'))
  );
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'in_progress' then
    raise exception 'You can close a work day while the job is in progress' using errcode = 'P0001';
  end if;
  select * into v_day from public.work_days
    where booking_id = p_booking_id and provider_id = v_uid
      and work_date = (now() at time zone 'Asia/Manila')::date for update;
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
      'link', '/customer/bookings/' || p_booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;

create or replace function public.admin_provider_payroll_candidates(p_from date, p_to date)
returns table (
  work_day_id uuid,
  booking_id uuid,
  provider_id uuid,
  provider_name text,
  work_date date,
  week_ending date,
  booking_description text,
  close_note text,
  close_photo_paths text[],
  payout_method public.payout_method,
  payout_account_name text,
  payout_account_number text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators can view payroll' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'Choose a payroll date range of up to one year';
  end if;
  return query
    select w.id, w.booking_id, w.provider_id,
      coalesce(nullif(concat_ws(' ', p.first_name, p.last_name), ''), 'Provider'),
      w.work_date,
      w.work_date + (6 - extract(dow from w.work_date)::integer),
      b.description,
      w.close_note,
      w.close_photo_paths,
      pp.payout_method, pp.payout_account_name, pp.payout_account_number
    from public.work_days w
    join public.bookings b on b.id = w.booking_id
    join public.profiles p on p.id = w.provider_id and p.role = 'provider'
    join public.provider_profiles pp on pp.profile_id = w.provider_id
    left join public.payouts py on py.work_day_id = w.id
    where w.closed_at is not null and w.work_date between p_from and p_to and py.id is null
      and not exists (select 1 from public.work_days other
        where other.provider_id = w.provider_id and other.work_date = w.work_date and other.id <> w.id)
      and (
        b.status in ('done','signed','balance_paid','completed')
        or exists (select 1 from public.provider_assignments a
          where a.booking_id = w.booking_id and a.provider_id = w.provider_id
            and a.phase = 'execution' and a.status = 'completed')
        or exists (select 1 from public.milestones m
          where m.booking_id = w.booking_id and m.status = 'confirmed'
            and m.confirmed_at is not null
            and (m.confirmed_at at time zone 'Asia/Manila')::date >= w.work_date)
      )
    order by w.work_date, provider_name;
end;
$$;
revoke all on function public.admin_provider_payroll_candidates(date,date) from public, anon;
grant execute on function public.admin_provider_payroll_candidates(date,date) to authenticated;

create function public.admin_create_provider_payout_batch(
  p_provider uuid, p_week_ending date, p_work_day_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method public.payout_method;
  v_batch public.payout_batches%rowtype;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators can create payroll batches' using errcode = '42501'; end if;
  if p_provider is null or p_week_ending is null or extract(dow from p_week_ending) <> 6
    or p_work_day_ids is null or cardinality(p_work_day_ids) not between 1 and 100
    or (select count(distinct selected.id) from unnest(p_work_day_ids) as selected(id))
      <> cardinality(p_work_day_ids) then
    raise exception 'Choose a provider, a Saturday week ending, and unique workdays';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_provider::text || p_week_ending::text, 0));
  select payout_method into v_method from public.provider_profiles
    where profile_id = p_provider for update;
  if v_method is null then raise exception 'The provider must save a payout method before payroll'; end if;

  select count(*) into v_count
  from public.work_days w
  join public.bookings b on b.id = w.booking_id
  where w.id = any(p_work_day_ids) and w.provider_id = p_provider and w.closed_at is not null
    and w.work_date between p_week_ending - 6 and p_week_ending
    and not exists (select 1 from public.payouts py where py.work_day_id = w.id)
    and not exists (select 1 from public.work_days other
      where other.provider_id = w.provider_id and other.work_date = w.work_date and other.id <> w.id)
    and (
      b.status in ('done','signed','balance_paid','completed')
      or exists (select 1 from public.provider_assignments a
        where a.booking_id = w.booking_id and a.provider_id = w.provider_id
          and a.phase = 'execution' and a.status = 'completed')
      or exists (select 1 from public.milestones m
        where m.booking_id = w.booking_id and m.status = 'confirmed'
          and m.confirmed_at is not null
          and (m.confirmed_at at time zone 'Asia/Manila')::date >= w.work_date)
    );
  if v_count <> cardinality(p_work_day_ids) then
    raise exception 'One or more workdays are not eligible, are already in payroll, or are outside this Saturday week';
  end if;

  select * into v_batch from public.payout_batches
    where provider_id = p_provider and week_ending = p_week_ending for update;
  if found and v_batch.status <> 'pending' then
    raise exception 'This provider''s Saturday payout batch has already been paid';
  end if;
  if not found then
    insert into public.payout_batches(provider_id,week_ending,method,created_by)
      values (p_provider,p_week_ending,v_method,auth.uid())
      returning * into v_batch;
  elsif v_batch.method <> v_method then
    raise exception 'The provider changed payout method. Resolve the existing batch before adding workdays';
  end if;

  insert into public.payouts(provider_id,booking_id,work_day_id,batch_id,amount,method,status)
    select w.provider_id,w.booking_id,w.id,v_batch.id,1000,v_method,'pending'
    from public.work_days w where w.id = any(p_work_day_ids);
  update public.payout_batches
    set day_count = day_count + v_count, amount = amount + (v_count * 1000)
    where id = v_batch.id
    returning * into v_batch;
  perform public.write_audit(auth.uid(),'payout.batch_created','payout_batches',v_batch.id::text,null,
    jsonb_build_object('provider_id',p_provider,'week_ending',p_week_ending,'days',v_count,'amount',v_count * 1000));
  return jsonb_build_object('id',v_batch.id,'day_count',v_batch.day_count,'amount',v_batch.amount);
end;
$$;
revoke all on function public.admin_create_provider_payout_batch(uuid,date,uuid[]) from public, anon;
grant execute on function public.admin_create_provider_payout_batch(uuid,date,uuid[]) to authenticated;

create function public.admin_mark_provider_payout_batch_paid(p_batch uuid,p_reference text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_batch public.payout_batches%rowtype;
begin
  if not public.is_admin() then raise exception 'Only MAZ administrators can mark payroll paid' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_reference,''))) not between 3 and 120 then
    raise exception 'Record the transfer reference or cash receipt number';
  end if;
  select * into v_batch from public.payout_batches where id = p_batch for update;
  if not found or v_batch.status <> 'pending' then raise exception 'This payout batch is no longer pending'; end if;
  update public.payout_batches set status='paid',reference=btrim(p_reference),paid_at=now() where id=v_batch.id;
  update public.payouts set status='paid',reference=btrim(p_reference),paid_at=now()
    where batch_id=v_batch.id and status='pending';
  perform public.write_audit(auth.uid(),'payout.batch_paid','payout_batches',v_batch.id::text,null,
    jsonb_build_object('provider_id',v_batch.provider_id,'amount',v_batch.amount,'reference',btrim(p_reference)));
end;
$$;
revoke all on function public.admin_mark_provider_payout_batch_paid(uuid,text) from public, anon;
grant execute on function public.admin_mark_provider_payout_batch_paid(uuid,text) to authenticated;
