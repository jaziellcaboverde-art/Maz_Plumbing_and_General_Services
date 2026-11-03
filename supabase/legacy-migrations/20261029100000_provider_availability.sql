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
