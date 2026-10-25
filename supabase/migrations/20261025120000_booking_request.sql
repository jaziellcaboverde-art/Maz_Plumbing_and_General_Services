-- Phase 6: booking request. Photos for a request, and one function that submits a draft.
--
-- Photos go in a private bucket. First folder is the booking id. The customer adds and removes
-- photos while the booking is a draft. The customer, the booking's provider and admin read them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('booking-photos', 'booking-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "booking photos: parties or admin read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'booking-photos'
    and ((select public.is_booking_party_text((storage.foldername(name))[1])) or (select public.is_admin()))
  );
create policy "booking photos: customer adds to own draft" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.customer_id = (select auth.uid())
        and b.status = 'draft'
    )
  );
create policy "booking photos: customer removes from own draft" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'booking-photos'
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[1]
        and b.customer_id = (select auth.uid())
        and b.status = 'draft'
    )
  );

-- Step 6.10: a draft becomes open only here. The function checks every rule again on the server,
-- sets the job class (major when the customer ticked major renovation or the service is major),
-- records the Terms acceptance time, then moves the status through change_booking_status.
create function public.submit_booking(p_booking_id uuid, p_terms_accepted boolean)
returns public.booking_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_service public.services%rowtype;
  v_class public.job_class;
begin
  if v_uid is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings
  where id = p_booking_id and customer_id = v_uid for update;
  if not found then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;
  if v_booking.status <> 'draft' then
    raise exception 'Only a draft can be submitted';
  end if;
  if v_booking.service_id is null then
    raise exception 'Choose a service';
  end if;
  select * into v_service from public.services where id = v_booking.service_id;
  if not v_service.active then
    raise exception 'This service is not available for new bookings';
  end if;
  if length(btrim(coalesce(v_booking.description, ''))) < 10 then
    raise exception 'Describe the job in at least 10 characters';
  end if;
  if v_booking.address_id is null or not exists (
    select 1 from public.addresses a
    where a.id = v_booking.address_id and a.profile_id = v_uid and a.location is not null
  ) then
    raise exception 'Choose a service address that has a map pin';
  end if;
  if v_booking.is_urgent then
    if not v_service.urgent_allowed then
      raise exception 'This service does not allow urgent requests';
    end if;
  elsif v_booking.preferred_start is null or v_booking.preferred_start <= now() then
    raise exception 'Choose a date and time in the future';
  end if;
  if p_terms_accepted is distinct from true then
    raise exception 'Read and accept the Terms to continue';
  end if;

  v_class := case when v_booking.is_major_renovation or v_service.default_class = 'major'
    then 'major'::public.job_class else 'minor'::public.job_class end;
  update public.bookings
  set job_class = v_class,
      terms_accepted_at = now(),
      preferred_start = case when v_booking.is_urgent then null else v_booking.preferred_start end
  where id = p_booking_id;

  return public.change_booking_status(p_booking_id, 'open', null);
end;
$$;
revoke all on function public.submit_booking(uuid, boolean) from public, anon;
grant execute on function public.submit_booking(uuid, boolean) to authenticated;
