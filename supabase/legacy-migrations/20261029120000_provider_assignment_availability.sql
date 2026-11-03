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
