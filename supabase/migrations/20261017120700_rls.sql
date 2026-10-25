-- Steps 2.13 and 2.14: deny by default, then row level security per role.
-- Writes that move money, change a status or change a role do not go through the browser.
-- They run in server code with the service role, or in database functions.

-- Deny by default ------------------------------------------------------------------------
-- New tables and sequences made by later migrations start with no access for the browser
-- roles. A later migration must grant exactly what its phase needs.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

do $$
declare
  r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end;
$$;

-- Helper functions -----------------------------------------------------------------------
-- Security definer so a policy on one table can look at another without RLS looping back.
create function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select p.role from public.profiles p where p.id = auth.uid() $$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false) $$;

create function public.is_booking_customer(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.bookings b where b.id = p_booking and b.customer_id = auth.uid()) $$;

-- The provider who accepted the job (the foreman on large jobs).
create function public.is_booking_provider(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.bookings b where b.id = p_booking and b.provider_id = auth.uid()) $$;

-- A provider who has been offered the job, before accepting.
create function public.has_offer_on(p_booking uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.offers o where o.booking_id = p_booking and o.provider_id = auth.uid()) $$;

create function public.is_payout_owner(p_payout uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.payouts po where po.id = p_payout and po.provider_id = auth.uid()) $$;

-- For storage paths. The first folder is a booking id. Anything else is not a party.
create function public.is_booking_party_text(p_booking text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when p_booking ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_booking_customer(p_booking::uuid) or public.is_booking_provider(p_booking::uuid)
    else false
  end
$$;

-- profiles -------------------------------------------------------------------------------
grant select on public.profiles to authenticated;
-- Role is not in this list, so nobody can change their own role from the browser.
grant update (first_name, last_name, mobile, birthday, account_type, business_name)
  on public.profiles to authenticated;
create policy "profiles: read own or admin" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- addresses ------------------------------------------------------------------------------
grant select, insert, update, delete on public.addresses to authenticated;
create policy "addresses: read own, admin, or the accepted provider" on public.addresses
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.bookings b
      where b.address_id = addresses.id and b.provider_id = (select auth.uid())
    )
  );
create policy "addresses: add own" on public.addresses for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "addresses: change own" on public.addresses for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy "addresses: delete own" on public.addresses for delete to authenticated
  using (profile_id = (select auth.uid()));

-- provider_profiles ----------------------------------------------------------------------
grant select on public.provider_profiles to authenticated;
-- Status, rate and review fields change only through server code (Phase 5).
grant update (payout_method, payout_account_name, payout_account_number,
              emergency_contact_name, emergency_contact_phone, base_location)
  on public.provider_profiles to authenticated;
create policy "provider_profiles: read own or admin" on public.provider_profiles
  for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy "provider_profiles: update own" on public.provider_profiles
  for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- provider_documents ---------------------------------------------------------------------
grant select, insert (provider_id, kind, storage_path) on public.provider_documents to authenticated;
create policy "provider_documents: read own or admin" on public.provider_documents
  for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "provider_documents: add own" on public.provider_documents
  for insert to authenticated with check (provider_id = (select auth.uid()));

-- services -------------------------------------------------------------------------------
grant select on public.services to anon, authenticated;
grant insert, update on public.services to authenticated;
create policy "services: read active" on public.services for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy "services: admin adds" on public.services for insert to authenticated
  with check ((select public.is_admin()));
create policy "services: admin changes" on public.services for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- provider_services ----------------------------------------------------------------------
grant select, insert, delete on public.provider_services to authenticated;
create policy "provider_services: read own or admin" on public.provider_services
  for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "provider_services: add own" on public.provider_services
  for insert to authenticated with check (provider_id = (select auth.uid()));
create policy "provider_services: remove own" on public.provider_services
  for delete to authenticated using (provider_id = (select auth.uid()));

-- user_settings --------------------------------------------------------------------------
grant select, insert, update on public.user_settings to authenticated;
create policy "user_settings: read own" on public.user_settings for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "user_settings: add own" on public.user_settings for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy "user_settings: change own" on public.user_settings for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

-- config: admin only. Customers and providers get what they need through functions later.
grant select on public.config to authenticated;
grant update (value) on public.config to authenticated;
create policy "config: admin reads" on public.config for select to authenticated
  using ((select public.is_admin()));
create policy "config: admin changes" on public.config for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- bookings -------------------------------------------------------------------------------
grant select, delete on public.bookings to authenticated;
grant insert (customer_id, service_id, address_id, description, preferred_start, is_urgent, is_major_renovation)
  on public.bookings to authenticated;
-- No status, tier, price, provider or counter columns here. Status moves only through
-- change_booking_status. The rest is written by server code.
grant update (service_id, address_id, description, preferred_start, is_urgent, is_major_renovation)
  on public.bookings to authenticated;
create policy "bookings: read as customer, provider, offered provider or admin" on public.bookings
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or provider_id = (select auth.uid())
    or (select public.has_offer_on(id))
    or (select public.is_admin())
  );
create policy "bookings: customer starts a draft" on public.bookings for insert to authenticated
  with check (customer_id = (select auth.uid()) and status = 'draft');
create policy "bookings: customer edits own draft" on public.bookings for update to authenticated
  using (customer_id = (select auth.uid()) and status = 'draft')
  with check (customer_id = (select auth.uid()) and status = 'draft');
create policy "bookings: customer deletes own draft" on public.bookings for delete to authenticated
  using (customer_id = (select auth.uid()) and status = 'draft');

-- offers ---------------------------------------------------------------------------------
grant select on public.offers to authenticated;
create policy "offers: read as the provider, the customer or admin" on public.offers
  for select to authenticated
  using (
    provider_id = (select auth.uid())
    or (select public.is_booking_customer(booking_id))
    or (select public.is_admin())
  );

-- Tables the customer and the accepted provider both read -------------------------------
grant select on public.quotes, public.milestones, public.work_days, public.materials,
  public.punch_items, public.signatures, public.messages to authenticated;
create policy "quotes: read as party or admin" on public.quotes for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
create policy "milestones: read as party or admin" on public.milestones for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
create policy "work_days: read as party or admin" on public.work_days for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
create policy "materials: read as party or admin" on public.materials for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
create policy "punch_items: read as party or admin" on public.punch_items for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
create policy "signatures: read as party or admin" on public.signatures for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));
-- Step 2.14: admin reads every chat thread.
create policy "messages: read as party or admin" on public.messages for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));

-- Money the customer pays: customer and admin only. Providers do not see customer payments.
grant select on public.payments, public.cash_records, public.receipts to authenticated;
create policy "payments: read as customer or admin" on public.payments for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_admin()));
create policy "cash_records: read as customer or admin" on public.cash_records for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_admin()));
create policy "receipts: read as customer or admin" on public.receipts for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_admin()));

grant select on public.cancellations to authenticated;
create policy "cancellations: read as party or admin" on public.cancellations for select to authenticated
  using ((select public.is_booking_customer(booking_id)) or (select public.is_booking_provider(booking_id))
         or (select public.is_admin()));

-- Provider pay ---------------------------------------------------------------------------
grant select on public.payouts, public.payout_slips to authenticated;
create policy "payouts: read own or admin" on public.payouts for select to authenticated
  using (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "payout_slips: read own or admin" on public.payout_slips for select to authenticated
  using ((select public.is_payout_owner(payout_id)) or (select public.is_admin()));

-- reviews, notifications, legal, consents, audit log -------------------------------------
grant select on public.reviews to authenticated;
create policy "reviews: read shown reviews or admin" on public.reviews for select to authenticated
  using (not hidden or (select public.is_admin()));

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications: read own" on public.notifications for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "notifications: mark own read" on public.notifications for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));

grant select on public.legal_versions to anon, authenticated;
create policy "legal_versions: read published" on public.legal_versions for select to anon, authenticated
  using (published_at is not null and published_at <= now());

grant select, insert (profile_id, legal_version_id, device) on public.consents to authenticated;
create policy "consents: read own or admin" on public.consents for select to authenticated
  using (profile_id = (select auth.uid()) or (select public.is_admin()));
create policy "consents: add own" on public.consents for insert to authenticated
  with check (profile_id = (select auth.uid()));

grant select on public.audit_log to authenticated;
create policy "audit_log: admin reads" on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- booking_status_moves has no grants and no policies on purpose. Only the status function reads it.
