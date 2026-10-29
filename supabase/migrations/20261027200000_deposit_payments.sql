-- Phase 9, steps 9.9 to 9.14: paying the deposit.
-- start_deposit_payment: the customer asks to pay. It makes (or reuses) one pending payment row.
-- apply_payment_result: server only. PayMongo's answer (or the test-mode answer) lands here.
-- It is safe to call twice with the same result: the booking changes once (step 9.16).

alter table public.payments
  add column if not exists failure_reason text,
  add column if not exists checkout_session_id text;

create or replace function public.start_deposit_payment(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_quote public.quotes%rowtype;
  v_payment public.payments%rowtype;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'quoted' then
    raise exception 'This booking is not waiting for a deposit' using errcode = 'P0001';
  end if;
  select * into v_quote from public.quotes
    where booking_id = p_booking_id and status = 'accepted' order by decided_at desc nulls last limit 1;
  if not found or coalesce(v_quote.deposit_amount, 0) <= 0 then
    raise exception 'Accept the quote first' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payments where booking_id = p_booking_id and kind = 'deposit' and status = 'paid') then
    raise exception 'The deposit is already paid' using errcode = 'P0001';
  end if;

  -- Reuse an open attempt so a double click never makes two charges.
  select * into v_payment from public.payments
    where booking_id = p_booking_id and kind = 'deposit' and status = 'pending'
    order by created_at desc limit 1;
  if not found then
    insert into public.payments (booking_id, kind, amount)
    values (p_booking_id, 'deposit', v_quote.deposit_amount)
    returning * into v_payment;
  end if;
  return jsonb_build_object('payment_id', v_payment.id, 'amount', v_payment.amount);
end;
$$;
revoke all on function public.start_deposit_payment(uuid) from public, anon;
grant execute on function public.start_deposit_payment(uuid) to authenticated;

create or replace function public.apply_payment_result(
  p_payment_id uuid,
  p_paid boolean,
  p_method public.payment_method default null,
  p_paymongo_payment_id text default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  -- Repeats: a paid payment never changes again.
  if v_payment.status = 'paid' then
    return jsonb_build_object('changed', false, 'booking_id', v_payment.booking_id, 'notify', '[]'::jsonb);
  end if;

  select * into v_booking from public.bookings where id = v_payment.booking_id for update;

  if not p_paid then
    update public.payments
      set status = 'failed', failure_reason = left(coalesce(p_reason, 'The payment did not go through'), 300)
      where id = p_payment_id;
    perform public.write_audit(null, 'payment.failed', 'payments', p_payment_id::text, left(p_reason, 300),
      jsonb_build_object('booking_id', v_payment.booking_id));
    return jsonb_build_object('changed', true, 'booking_id', v_payment.booking_id, 'notify', jsonb_build_array(
      jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'payment.failed',
        'title', 'Your payment did not go through',
        'body', 'No money was taken. You can try again from your booking.',
        'link', '/customer/bookings/' || v_payment.booking_id, 'channels', jsonb_build_array('in_app'))));
  end if;

  update public.payments
    set status = 'paid', method = coalesce(p_method, method), paid_at = now(), failure_reason = null,
        paymongo_payment_id = coalesce(p_paymongo_payment_id, paymongo_payment_id)
    where id = p_payment_id;

  if v_payment.kind = 'deposit' and v_booking.status = 'quoted' then
    perform public.change_booking_status(v_payment.booking_id, 'deposit_paid', 'Deposit paid');
  end if;

  insert into public.receipts (booking_id, payment_id, kind, amount)
  values (v_payment.booking_id, p_payment_id, v_payment.kind::text, v_payment.amount);

  perform public.write_audit(null, 'payment.paid', 'payments', p_payment_id::text, null,
    jsonb_build_object('booking_id', v_payment.booking_id, 'amount', v_payment.amount, 'method', p_method));

  return jsonb_build_object('changed', true, 'booking_id', v_payment.booking_id, 'notify', jsonb_build_array(
    jsonb_build_object('profile_id', v_booking.customer_id, 'event', 'payment.paid',
      'title', 'Deposit received', 'body', 'Your booking is confirmed. We sent you a payment acknowledgment.',
      'link', '/customer/bookings/' || v_payment.booking_id, 'channels', jsonb_build_array('in_app', 'email')),
    jsonb_build_object('profile_id', v_booking.provider_id, 'event', 'payment.paid',
      'title', 'The customer paid the deposit', 'body', 'You can now schedule the job.',
      'link', '/provider/jobs/' || v_payment.booking_id, 'channels', jsonb_build_array('in_app', 'email'))));
end;
$$;
revoke all on function public.apply_payment_result(uuid, boolean, public.payment_method, text, text) from public, anon, authenticated;
grant execute on function public.apply_payment_result(uuid, boolean, public.payment_method, text, text) to service_role;
