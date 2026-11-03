-- Prevent overlapping manual/gateway collection while a previous channel is unresolved.
create function public.guard_managed_collection_channel() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform 1 from public.bookings where id=new.booking_id for update;
  if tg_table_name='manual_payment_claims' then
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and gateway_checkout_claimed_at is not null) then raise exception 'MAZ must reconcile the existing gateway checkout before another payment channel is used'; end if;
  elsif new.manual_channel is null and new.status='pending' then
    if exists(select 1 from public.manual_payment_claims where booking_id=new.booking_id and status='pending') then raise exception 'MAZ must review the pending manual payment claim before another charge'; end if;
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and id<>new.id) then raise exception 'Reconcile the earlier pending checkout before starting another payment'; end if;
  elsif new.manual_channel is not null and new.status='paid' then
    if exists(select 1 from public.payments where booking_id=new.booking_id and status='pending' and manual_channel is null and gateway_checkout_claimed_at is not null) then raise exception 'Reconcile the gateway attempt before verifying another collection'; end if;
  end if;
  return new;
end $$;
create trigger manual_claim_channel_guard before insert on public.manual_payment_claims for each row execute function public.guard_managed_collection_channel();
create trigger payment_channel_guard before insert on public.payments for each row execute function public.guard_managed_collection_channel();

create function public.reconcile_managed_checkout(p_payment uuid,p_session text,p_url text,p_state text,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype;bid uuid;
begin
  if auth.role()<>'service_role' or not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Verified gateway server and MAZ administrator required' using errcode='42501'; end if;
  select booking_id into bid from public.payments where id=p_payment;
  perform 1 from public.bookings where id=bid for update;
  select * into p from public.payments where id=p_payment for update;
  if not found or p.manual_channel is not null or p.status<>'pending' or (p.checkout_session_id is not null and p.checkout_session_id<>p_session) then raise exception 'Payment is not an unresolved matching checkout'; end if;
  if p_state not in ('active','expired') or p_session not like 'cs_%' then raise exception 'Verify the existing checkout status first'; end if;
  update public.payments set checkout_session_id=p_session,gateway_checkout_url=p_url,status=case when p_state='expired' then 'failed'::public.payment_status else status end where id=p.id;
  perform public.write_audit(p_actor,'payment.checkout_reconciled','payments',p.id::text,null,jsonb_build_object('session',p_session,'state',p_state));
end $$;
revoke all on function public.reconcile_managed_checkout(uuid,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.reconcile_managed_checkout(uuid,text,text,text,uuid) to service_role;

-- Lock parent first consistently. A replay after refund must not resurrect principal.
create or replace function public.confirm_managed_gateway_payment(p_payment uuid,p_remote text,p_amount numeric,p_currency text,p_method public.payment_method)
returns void language plpgsql security definer set search_path='' as $$
declare p public.payments%rowtype;b public.bookings%rowtype;bid uuid;
begin
  if auth.role()<>'service_role' then raise exception 'Verified gateway server only' using errcode='42501'; end if;
  select booking_id into bid from public.payments where id=p_payment;
  select * into b from public.bookings where id=bid for update;
  select * into p from public.payments where id=p_payment for update;
  if not found or p.manual_channel is not null then raise exception 'Gateway payment record not found'; end if;
  if p_currency<>'PHP' or p_amount<>p.amount+p.processing_fee or p_remote is null then raise exception 'Gateway currency, amount or payment identifier does not match'; end if;
  if p.status in ('paid','partially_refunded','refunded') then
    if p.paymongo_payment_id is distinct from p_remote then raise exception 'A different gateway payment is already recorded'; end if;
    return;
  end if;
  update public.payments set status='paid',method=p_method,paid_at=now(),paymongo_payment_id=p_remote where id=p.id;
  insert into public.payment_events(booking_id,payment_id,kind,amount,reference) values(p.booking_id,p.id,'gateway_verified',p.amount,p_remote);
  insert into public.receipts(booking_id,payment_id,kind,amount) values(p.booking_id,p.id,p.kind::text,p.amount);
  if p.purpose='deposit' and b.status='quoted' and public.booking_payment_due(b.id,'deposit')=0 then perform public.change_booking_status(b.id,'deposit_paid','Verified PayMongo payment'); end if;
end $$;
