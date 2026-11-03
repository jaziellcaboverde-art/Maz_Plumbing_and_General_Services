-- Existing checkout IDs from the earlier payment flow also reserve their collection channel.
create or replace function public.guard_managed_collection_channel() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.bookings where id=new.booking_id for update;
  if tg_table_name='manual_payment_claims' then
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and (gateway_checkout_claimed_at is not null or checkout_session_id is not null)) then raise exception 'MAZ must reconcile the existing gateway checkout before another payment channel is used'; end if;
  elsif new.manual_channel is null and new.status='pending' then
    if exists(select 1 from public.manual_payment_claims where booking_id=new.booking_id and status='pending') then raise exception 'MAZ must review the pending manual payment claim before another charge'; end if;
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and id<>new.id) then raise exception 'Reconcile the earlier pending checkout before starting another payment'; end if;
  elsif new.manual_channel is not null and new.status='paid' then
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and (gateway_checkout_claimed_at is not null or checkout_session_id is not null)) then raise exception 'Reconcile the gateway attempt before verifying another collection'; end if;
  end if;
  return new;
end $$;
