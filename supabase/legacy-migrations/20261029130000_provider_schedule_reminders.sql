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
