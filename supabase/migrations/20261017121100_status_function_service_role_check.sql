-- Fix for open question 39: new style Supabase API keys (sb_secret_...).
-- Only the "who is the system" check changes. The status moves and the rules are the same.
-- Guests still cannot run this function: they have no execute right on it.

create or replace function public.change_booking_status(
  p_booking_id uuid,
  p_to public.booking_status,
  p_reason text default null
)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_actors text[];
  v_uid uuid := auth.uid();
  v_role public.user_role;
  v_actor text;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  select m.actors into v_actors
  from public.booking_status_moves m
  where m.from_status = v_booking.status and m.to_status = p_to;
  if v_actors is null then
    raise exception 'A booking cannot move from % to %', v_booking.status, p_to using errcode = 'P0001';
  end if;

  if v_uid is null then
    -- No signed in user. Only trusted server code (service role) may act as the system.
    -- Two signals, because the new style secret keys may not carry a role claim in the token:
    -- the token role claim, or the database role the API gateway switched to.
    if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', '') <> 'service_role'
       and coalesce(current_setting('role', true), '') <> 'service_role' then
      raise exception 'Sign in first' using errcode = '42501';
    end if;
    v_actor := 'system';
  else
    select p.role into v_role from public.profiles p where p.id = v_uid;
    v_actor := case
      when v_role = 'admin' then 'admin'
      when v_role = 'customer' and v_booking.customer_id = v_uid then 'customer'
      when v_role = 'provider' and (
        v_booking.provider_id = v_uid
        or v_booking.picked_provider_id = v_uid
        or exists (
          select 1 from public.offers o
          where o.booking_id = v_booking.id and o.provider_id = v_uid and o.status = 'pending'
        )
      ) then 'provider'
      else null
    end;
  end if;

  if v_actor is null or not (v_actor = any (v_actors)) then
    raise exception 'You cannot make this change' using errcode = '42501';
  end if;

  perform set_config('app.status_change', 'on', true);
  update public.bookings
  set status = p_to,
      cancelled_at = case when p_to = 'cancelled' then now() else cancelled_at end,
      cancel_reason = case when p_to = 'cancelled' then p_reason else cancel_reason end
  where id = p_booking_id;
  perform set_config('app.status_change', 'off', true);

  perform public.write_audit(
    v_uid, 'booking.status', 'bookings', p_booking_id::text, p_reason,
    jsonb_build_object('from', v_booking.status, 'to', p_to, 'actor', v_actor)
  );
  return p_to;
end;
$$;

revoke all on function public.change_booking_status(uuid, public.booking_status, text) from public, anon;
grant execute on function public.change_booking_status(uuid, public.booking_status, text) to authenticated, service_role;
