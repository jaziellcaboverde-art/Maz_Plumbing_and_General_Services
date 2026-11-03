-- Read-only availability search. Mutation RPCs retain their locked final check.
create function public.admin_available_team_slots(
  p_booking uuid, p_providers uuid[], p_from date, p_after timestamptz,
  p_days integer default 14, p_duration integer default 60, p_buffer integer default 30
) returns table(starts_at timestamptz, ends_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'MAZ administrator access required' using errcode='42501';
  end if;
  if p_providers is null or cardinality(p_providers) not between 1 and 50
    or array_position(p_providers,null) is not null
    or (select count(distinct id) from unnest(p_providers) id) <> cardinality(p_providers)
    or p_days is null or p_days not between 1 and 14
    or p_duration is null or p_duration not between 30 and 480 or p_duration % 30 <> 0
    or p_buffer is null or p_buffer not between 0 and 240
    or p_from is null or p_from < (now() at time zone 'Asia/Manila')::date
    or p_from > (now() at time zone 'Asia/Manila')::date + 365
    or p_after is null then
    raise exception 'Choose workers, a valid date range, duration and travel buffer';
  end if;
  if not exists(select 1 from public.bookings b where b.id=p_booking
    and b.status not in ('draft','cancelled','done','signed','balance_paid','completed')) then
    raise exception 'This booking cannot receive an assignment';
  end if;
  if exists(select 1 from unnest(p_providers) id where not exists(
    select 1 from public.provider_profiles pp join public.profiles p on p.id=pp.profile_id
    where pp.profile_id=id and pp.status='approved' and p.role='provider')) then
    raise exception 'Select approved providers';
  end if;

  return query
  with days as (
    select (p_from + n)::date as work_date from generate_series(0,p_days-1) n
  ), windows as (
    select (d.work_date+h.starts_at) at time zone 'Asia/Manila' as window_start,
           (d.work_date+h.ends_at) at time zone 'Asia/Manila' as window_end
    from days d join public.provider_weekly_hours h
      on h.provider_id=p_providers[1] and h.weekday=extract(dow from d.work_date)
    union all
    select greatest(a.starts_at,p_from::timestamp at time zone 'Asia/Manila'),
           least(a.ends_at,(p_from+p_days)::timestamp at time zone 'Asia/Manila')
    from public.provider_availability a where a.provider_id=p_providers[1] and a.kind='available'
      and a.ends_at > p_from::timestamp at time zone 'Asia/Manila'
      and a.starts_at < (p_from+p_days)::timestamp at time zone 'Asia/Manila'
  ), candidates as (
    select distinct s as slot_start, s+make_interval(mins=>p_duration) as slot_end
    from windows w cross join lateral generate_series(w.window_start,
      w.window_end-make_interval(mins=>p_duration),interval '30 minutes') s
    where s>p_after and s>now()
  )
  select c.slot_start,c.slot_end from candidates c
  where not exists (
    select 1 from unnest(p_providers) worker
    where not (
      exists(select 1 from public.provider_availability a where a.provider_id=worker
        and a.kind='available' and a.starts_at<=c.slot_start and a.ends_at>=c.slot_end)
      or exists(select 1 from public.provider_weekly_hours h where h.provider_id=worker
        and h.weekday=extract(dow from c.slot_start at time zone 'Asia/Manila')
        and (c.slot_start at time zone 'Asia/Manila')::date=(c.slot_end at time zone 'Asia/Manila')::date
        and h.starts_at<=(c.slot_start at time zone 'Asia/Manila')::time
        and h.ends_at>=(c.slot_end at time zone 'Asia/Manila')::time)
    ) or not public.provider_slot_available(worker,p_booking,c.slot_start,c.slot_end,p_buffer)
  ) order by c.slot_start;
end;
$$;
revoke all on function public.admin_available_team_slots(uuid,uuid[],date,timestamptz,integer,integer,integer) from public,anon;
grant execute on function public.admin_available_team_slots(uuid,uuid[],date,timestamptz,integer,integer,integer) to authenticated;
