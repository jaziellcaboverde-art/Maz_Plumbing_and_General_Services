-- The admin, not the customer, chooses the provider for normal jobs.
-- The ranked list now shows on the admin Assignments page. Set matching.customer_pick to 1 to bring
-- the old customer choice back.

insert into public.config (key, value, description)
values ('matching.customer_pick', '0'::jsonb, '1 lets the customer choose from the ranked list. 0 means an admin assigns every normal job')
on conflict (key) do nothing;

create or replace function public.pick_provider(p_booking_id uuid, p_provider_id uuid, p_auto_chain boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id and customer_id = v_uid for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.status <> 'open' then raise exception 'This booking is not waiting for you to pick a provider'; end if;
  if public.cfg_number('matching.customer_pick', 0) <> 1 then raise exception 'Our team chooses the provider for your job' using errcode = 'P0001'; end if;
  if v_booking.is_urgent then raise exception 'Urgent jobs are offered to providers automatically'; end if;
  if v_booking.job_class = 'major' then raise exception 'An admin assigns a foreman for large jobs'; end if;
  if not public.provider_can_take(p_booking_id, p_provider_id, true) then
    raise exception 'This provider is not available for your job. Choose someone from the list';
  end if;

  update public.bookings set auto_chain = coalesce(p_auto_chain, false) where id = p_booking_id;
  v_result := public.make_offer(p_booking_id, p_provider_id, 'customer_pick');
  perform public.write_audit(v_uid, 'offer.created', 'offers', v_result ->> 'offer_id', null,
    jsonb_build_object('booking_id', p_booking_id, 'provider_id', p_provider_id, 'kind', 'customer_pick'));
  return v_result;
end;
$$;

create or replace function public.register_offer_miss(p_offer_id uuid, p_status public.offer_status, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_booking public.bookings%rowtype;
  v_next text;
  v_misses integer;
  v_why text;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_offer.status <> 'pending' then
    raise exception 'This offer is no longer open';
  end if;
  select * into v_booking from public.bookings where id = v_offer.booking_id for update;

  perform public.change_booking_status(v_offer.booking_id, 'open', p_reason);
  update public.offers
  set status = p_status, responded_at = now(), decline_reason = left(p_reason, 300)
  where id = p_offer_id;

  v_misses := v_booking.miss_count + 1;
  if v_offer.kind in ('foreman', 'admin_assign') then
    v_next := 'admin';
    v_why := case when p_status = 'expired'
      then 'The provider offered the job did not answer in time. Assign another provider.'
      else 'The provider offered the job declined it. Assign another provider.' end;
  elsif v_misses >= public.cfg_number('offer.max_misses', 3) then
    v_next := 'admin';
    v_why := 'Three providers declined or did not answer. Please help this customer find one.';
  elsif v_booking.is_urgent or v_booking.auto_chain then
    v_next := 'auto';
  elsif public.cfg_number('matching.customer_pick', 0) = 1 then
    v_next := 'customer';
  else
    v_next := 'admin';
    v_why := case when p_status = 'expired'
      then 'The provider offered the job did not answer in time. Assign another provider.'
      else 'The provider offered the job declined it. Assign another provider.' end;
  end if;

  update public.bookings
  set miss_count = v_misses,
      picked_provider_id = null,
      needs_admin = (v_next = 'admin'),
      needs_admin_reason = case when v_next = 'admin' then v_why else null end
  where id = v_offer.booking_id;

  perform public.write_audit(
    auth.uid(), 'offer.' || p_status::text, 'offers', p_offer_id::text, p_reason,
    jsonb_build_object('booking_id', v_offer.booking_id, 'provider_id', v_offer.provider_id, 'next', v_next)
  );
  return v_next;
end;
$$;
