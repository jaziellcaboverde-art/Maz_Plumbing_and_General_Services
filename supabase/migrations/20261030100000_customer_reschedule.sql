-- Customer reschedule (spec "Kumpuninja - System Process, Rules, at UI Specification" 3.I).
-- A customer may change the date and time of their own booking only while it is Pending, which is the
-- database statuses open and offered. After that the customer asks the admin. Urgent requests have no date,
-- so they cannot be rescheduled here. Cancelling already works through change_booking_status.

create function public.reschedule_booking(p_booking_id uuid, p_preferred_start timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings
  where id = p_booking_id and customer_id = v_uid for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status not in ('open', 'offered') then
    raise exception 'You can only reschedule a Pending booking. Message support to change it.' using errcode = 'P0001';
  end if;
  if v_booking.is_urgent then
    raise exception 'An urgent request has no date to change' using errcode = 'P0001';
  end if;
  if p_preferred_start is null or p_preferred_start <= now() then
    raise exception 'Choose a date and time in the future' using errcode = 'P0001';
  end if;

  update public.bookings set preferred_start = p_preferred_start where id = p_booking_id;

  perform public.write_audit(
    v_uid, 'booking.reschedule', 'bookings', p_booking_id::text, null,
    jsonb_build_object('from', v_booking.preferred_start, 'to', p_preferred_start, 'status', v_booking.status)
  );
  return p_preferred_start;
end;
$$;
revoke all on function public.reschedule_booking(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_booking(uuid, timestamptz) to authenticated;
