-- Steps 2.9 and 2.10: allowed status moves and the one function that applies them.
-- STATUS MOVES BELOW ARE A PROPOSAL. The owner confirms them (open-questions.md Q37).

create table public.booking_status_moves (
  from_status public.booking_status not null,
  to_status public.booking_status not null,
  -- Who may make this move: customer, provider, admin, system (trusted server code).
  actors text[] not null,
  primary key (from_status, to_status),
  check (actors <@ array['customer', 'provider', 'admin', 'system'])
);

insert into public.booking_status_moves (from_status, to_status, actors) values
  ('draft',        'open',         '{customer}'),
  ('draft',        'cancelled',    '{customer,admin}'),
  ('open',         'offered',      '{customer,admin,system}'),
  ('open',         'cancelled',    '{customer,admin}'),
  ('offered',      'accepted',     '{provider,admin}'),
  ('offered',      'open',         '{provider,admin,system}'),
  ('offered',      'cancelled',    '{customer,admin}'),
  -- After the provider accepts, the customer cannot cancel (Locked Decisions).
  ('accepted',     'quoted',       '{provider,admin}'),
  ('accepted',     'cancelled',    '{provider,admin}'),
  -- The customer may decline the quote, which is a cancel. The fee rule runs in Phase 10.
  ('quoted',       'deposit_paid', '{admin,system}'),
  ('quoted',       'cancelled',    '{customer,provider,admin}'),
  ('deposit_paid', 'scheduled',    '{provider,admin,system}'),
  ('deposit_paid', 'cancelled',    '{provider,admin}'),
  ('scheduled',    'on_the_way',   '{provider}'),
  ('scheduled',    'cancelled',    '{provider,admin}'),
  -- Once the provider is on the way, only admin can cancel.
  ('on_the_way',   'in_progress',  '{provider,admin,system}'),
  ('on_the_way',   'cancelled',    '{admin}'),
  ('in_progress',  'done',         '{provider,admin}'),
  ('in_progress',  'cancelled',    '{admin}'),
  ('done',         'signed',       '{customer,admin}'),
  ('signed',       'balance_paid', '{admin,system}'),
  ('balance_paid', 'completed',    '{admin,system}');

-- Guard: a status can only change inside change_booking_status.
create function public.bookings_status_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'A new booking must start as draft' using errcode = '42501';
    end if;
  elsif new.status is distinct from old.status then
    if coalesce(current_setting('app.status_change', true), 'off') <> 'on' then
      raise exception 'Booking status can only change through change_booking_status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_status_guard before insert or update on public.bookings
  for each row execute function public.bookings_status_guard();

create function public.change_booking_status(
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
    if coalesce((nullif(current_setting('request.jwt.claims', true), '')::jsonb) ->> 'role', '') <> 'service_role' then
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
-- Signed in users and server code may call it. Guests may not.
revoke all on function public.change_booking_status(uuid, public.booking_status, text) from public, anon;
grant execute on function public.change_booking_status(uuid, public.booking_status, text) to authenticated, service_role;
