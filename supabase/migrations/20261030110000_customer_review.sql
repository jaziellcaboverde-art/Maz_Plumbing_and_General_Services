-- Customer review (spec 3.H and BR-10): after the work is finished the customer rates the provider,
-- 1 to 5 stars and an optional comment. One review per booking (reviews.booking_id is unique).
-- Customers had read access to reviews but no way to write one, so this function is the only way in.

create function public.submit_review(p_booking_id uuid, p_stars integer, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings
  where id = p_booking_id and customer_id = v_uid;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  -- Completed in the spec is the finished-work statuses here (see lib/booking/official-status.ts).
  if v_booking.status not in ('done', 'signed', 'balance_paid', 'completed') then
    raise exception 'You can review a provider after the booking is Completed' using errcode = 'P0001';
  end if;
  if v_booking.provider_id is null then
    raise exception 'This booking has no provider to review' using errcode = 'P0001';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Choose 1 to 5 stars' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.reviews r where r.booking_id = p_booking_id) then
    raise exception 'You already reviewed this booking' using errcode = 'P0001';
  end if;

  insert into public.reviews (booking_id, customer_id, provider_id, stars, comment)
  values (p_booking_id, v_uid, v_booking.provider_id, p_stars, nullif(btrim(coalesce(p_comment, '')), ''))
  returning id into v_id;

  perform public.write_audit(
    v_uid, 'review.create', 'reviews', v_id::text, null,
    jsonb_build_object('booking_id', p_booking_id, 'stars', p_stars)
  );
  return v_id;
end;
$$;
revoke all on function public.submit_review(uuid, integer, text) from public, anon;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;
