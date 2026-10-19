-- Q37/Q44: an admin may cancel an on-the-way booking only before the site
-- inspection has been recorded. The assigned provider or an admin records
-- the inspection through mark_booking_site_inspected().

alter table public.bookings
  add column site_inspected_at timestamptz;

create function public.guard_on_the_way_cancel_before_inspection()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'on_the_way'
     and new.status = 'cancelled'
     and old.site_inspected_at is not null then
    raise exception 'An on-the-way booking cannot be cancelled after site inspection'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger bookings_on_the_way_cancel_inspection_guard
  before update of status on public.bookings
  for each row execute function public.guard_on_the_way_cancel_before_inspection();

create function public.mark_booking_site_inspected(p_booking_id uuid)
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
    select p.role into v_role
    from public.profiles p
    where p.id = v_uid;

    v_actor := case
      when v_role = 'admin' then 'admin'
      when v_role = 'provider'
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
