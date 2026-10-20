-- Applicants keep customer role for authentication but are confined to their application.
-- These database policies also block booking/provider-service writes that bypass page routing.

create or replace function public.is_provider_applicant()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = auth.uid() and pp.status in ('pending', 'rejected') and p.role = 'customer'
  )
$$;

create or replace function public.is_approved_provider()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles pp
    join public.profiles p on p.id = pp.profile_id
    where pp.profile_id = auth.uid() and pp.status = 'approved' and p.role = 'provider'
  )
$$;

create or replace function public.is_booking_customer(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking and b.customer_id = auth.uid()
      and not public.is_provider_applicant()
  )
$$;

drop policy if exists "bookings: read as customer, provider, offered provider or admin" on public.bookings;
create policy "bookings: read as customer, provider, offered provider or admin" on public.bookings
  for select to authenticated
  using (
    (customer_id = (select auth.uid()) and not (select public.is_provider_applicant()))
    or provider_id = (select auth.uid())
    or (select public.has_offer_on(id))
    or (select public.is_admin())
  );

drop policy if exists "addresses: read own, admin, or the accepted provider" on public.addresses;
create policy "addresses: read own, admin, or the accepted provider" on public.addresses
  for select to authenticated
  using (
    (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()))
    or (select public.is_admin())
    or exists (
      select 1 from public.bookings b
      where b.address_id = addresses.id and b.provider_id = (select auth.uid())
    )
  );

drop policy if exists "bookings: customer starts a draft" on public.bookings;
create policy "bookings: customer starts a draft" on public.bookings
  for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'draft' and not (select public.is_provider_applicant()));

drop policy if exists "bookings: customer edits own draft" on public.bookings;
create policy "bookings: customer edits own draft" on public.bookings
  for update to authenticated
  using (customer_id = (select auth.uid()) and status = 'draft' and not (select public.is_provider_applicant()))
  with check (customer_id = (select auth.uid()) and status = 'draft' and not (select public.is_provider_applicant()));

drop policy if exists "bookings: customer deletes own draft" on public.bookings;
create policy "bookings: customer deletes own draft" on public.bookings
  for delete to authenticated
  using (customer_id = (select auth.uid()) and status = 'draft' and not (select public.is_provider_applicant()));

drop policy if exists "provider_services: add own" on public.provider_services;
create policy "provider_services: add own" on public.provider_services
  for insert to authenticated
  with check (provider_id = (select auth.uid()) and (select public.is_approved_provider()));

drop policy if exists "provider_services: remove own" on public.provider_services;
create policy "provider_services: remove own" on public.provider_services
  for delete to authenticated
  using (provider_id = (select auth.uid()) and (select public.is_approved_provider()));

-- The applicant status page is read-only except for marking their own admin message as read.
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid()) and not (select public.is_provider_applicant()))
  with check (id = (select auth.uid()) and not (select public.is_provider_applicant()));

drop policy if exists "addresses: add own" on public.addresses;
create policy "addresses: add own" on public.addresses for insert to authenticated
  with check (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()));
drop policy if exists "addresses: change own" on public.addresses;
create policy "addresses: change own" on public.addresses for update to authenticated
  using (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()))
  with check (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()));
drop policy if exists "addresses: delete own" on public.addresses;
create policy "addresses: delete own" on public.addresses for delete to authenticated
  using (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()));

drop policy if exists "provider_profiles: update own" on public.provider_profiles;
drop policy if exists "user_settings: add own" on public.user_settings;
create policy "user_settings: add own" on public.user_settings for insert to authenticated
  with check (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()));
drop policy if exists "user_settings: change own" on public.user_settings;
create policy "user_settings: change own" on public.user_settings for update to authenticated
  using (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()))
  with check (profile_id = (select auth.uid()) and not (select public.is_provider_applicant()));
