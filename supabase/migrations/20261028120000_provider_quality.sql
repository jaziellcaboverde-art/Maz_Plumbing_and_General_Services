-- Provider quality: per-service approval with proof, large jobs need experience,
-- automatic quality flags, optional interview.

-- ---------------------------------------------------------------------------------------------
-- 1. Service claims. An applicant claims services and gives proof for each (certificate or work
--    photos). provider_services stays the list of APPROVED services, so matching is unchanged.

create table public.provider_service_claims (
  provider_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  proof_paths text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  primary key (provider_id, service_id)
);
alter table public.provider_service_claims enable row level security;
-- No grants to the browser roles: proof is private, admins read it through server code.

-- Backfill: people already approved keep their services. Pending applicants wait for review.
insert into public.provider_service_claims (provider_id, service_id, status, decided_at)
select ps.provider_id, ps.service_id,
       case when pp.status = 'approved' then 'approved' else 'pending' end,
       case when pp.status = 'approved' then now() end
from public.provider_services ps
left join public.provider_profiles pp on pp.profile_id = ps.provider_id
on conflict do nothing;
delete from public.provider_services ps
where exists (select 1 from public.provider_profiles pp where pp.profile_id = ps.provider_id and pp.status = 'pending');

alter table public.provider_profiles
  add column if not exists interview_done_at timestamptz,
  add column if not exists interview_notes text;

insert into public.config (key, value, description) values
  ('probation.large_job_min_finished', '3'::jsonb, 'Finished jobs a provider needs before they are offered large jobs automatically. An admin can still assign by hand'),
  ('quality.min_avg_stars', '3.5'::jsonb, 'Flag a provider when the average of their last 5 reviews falls below this'),
  ('quality.min_reviews', '3'::jsonb, 'Reviews needed before the average is checked'),
  ('quality.low_star_limit', '2'::jsonb, 'Flag a provider after this many reviews of 2 stars or less in 90 days'),
  ('provider.interview_required', 'false'::jsonb, 'Require interview or trial notes before an application can be approved')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 2. Large jobs go automatically only to providers who have finished enough jobs.

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

-- ---------------------------------------------------------------------------------------------
-- 3. Quality flags. A review can raise one. An admin resolves it with a note.

create table public.quality_flags (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('low_rating', 'complaints')),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now(),
  check (status = 'open' or (resolved_at is not null and resolution_note is not null))
);
create unique index quality_flags_one_open on public.quality_flags (provider_id, reason) where status = 'open';
alter table public.quality_flags enable row level security;
-- No browser grants. The admin screen reads this through server code.

create or replace function public.check_provider_quality(p_provider uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min_reviews integer := public.cfg_number('quality.min_reviews', 3)::integer;
  v_min_avg numeric := public.cfg_number('quality.min_avg_stars', 3.5);
  v_low_limit integer := public.cfg_number('quality.low_star_limit', 2)::integer;
  v_count integer;
  v_avg numeric;
  v_low integer;
begin
  select count(*), round(avg(stars), 2) into v_count, v_avg
  from (select stars from public.reviews where provider_id = p_provider and not hidden order by created_at desc limit 5) r;
  if v_count >= v_min_reviews and v_avg < v_min_avg then
    insert into public.quality_flags (provider_id, reason, details)
    values (p_provider, 'low_rating', jsonb_build_object('average_of_last_reviews', v_avg, 'reviews_counted', v_count))
    on conflict do nothing;
  end if;
  select count(*) into v_low from public.reviews
    where provider_id = p_provider and not hidden and stars <= 2 and created_at > now() - interval '90 days';
  if v_low >= v_low_limit then
    insert into public.quality_flags (provider_id, reason, details)
    values (p_provider, 'complaints', jsonb_build_object('low_reviews_90_days', v_low))
    on conflict do nothing;
  end if;
end;
$$;
revoke all on function public.check_provider_quality(uuid) from public, anon, authenticated;

create or replace function public.reviews_quality_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.check_provider_quality(new.provider_id);
  return null;
end;
$$;
create trigger reviews_check_quality after insert or update of stars, hidden on public.reviews
  for each row execute function public.reviews_quality_check();

create or replace function public.resolve_quality_flag(p_flag_id uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and role = 'admin') then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Write what you did about it (at least 5 characters)' using errcode = 'P0001';
  end if;
  update public.quality_flags
    set status = 'resolved', resolved_by = v_uid, resolved_at = now(), resolution_note = left(btrim(p_note), 500)
    where id = p_flag_id and status = 'open';
  if not found then raise exception 'This flag is already resolved' using errcode = 'P0001'; end if;
  perform public.write_audit(v_uid, 'quality_flag.resolved', 'quality_flags', p_flag_id::text, left(btrim(p_note), 500), '{}'::jsonb);
end;
$$;
revoke all on function public.resolve_quality_flag(uuid, text) from public, anon;
grant execute on function public.resolve_quality_flag(uuid, text) to authenticated;

-- When provider details are removed (resignation), the service claims go too.
create or replace function public.remove_claims_with_provider_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.provider_service_claims where provider_id = old.profile_id;
  return null;
end;
$$;
create trigger provider_profiles_remove_claims after delete on public.provider_profiles
  for each row execute function public.remove_claims_with_provider_profile();
