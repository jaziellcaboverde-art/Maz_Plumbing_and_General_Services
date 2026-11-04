-- Keep every provider offered as an admin recommendation eligible for the booking time.
create function public.admin_available_providers_for_booking(p_booking uuid)
returns table(provider_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_booking public.bookings%rowtype;
  v_start timestamptz;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Provider recommendations must use the validated server route'
      using errcode = '42501';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking;
  if not found or v_booking.service_id is null then
    return;
  end if;

  v_start := coalesce(v_booking.scheduled_start, v_booking.preferred_start);
  if v_start is null then
    return;
  end if;

  return query
  select distinct pp.profile_id
  from public.provider_profiles pp
  join public.provider_services ps on ps.provider_id = pp.profile_id
  where pp.status = 'approved'
    and ps.service_id = v_booking.service_id
    and not exists (
      select 1
      from public.offers o
      where o.booking_id = v_booking.id
        and o.provider_id = pp.profile_id
        and o.status in ('declined', 'expired')
    )
    and public.provider_slot_available(
      pp.profile_id,
      v_booking.id,
      v_start,
      v_start + interval '1 hour',
      30
    )
  order by pp.profile_id;
end;
$$;

revoke all on function public.admin_available_providers_for_booking(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_available_providers_for_booking(uuid)
  to service_role;
