-- Service catalog: an admin can remove a service, but only an inactive one.
-- Bookings keep a restrict foreign key to services, so a service that was ever booked cannot be
-- deleted by the database either. The admin API also checks and says so in plain words.
-- Basis: Kumpuninja System Process, Rules, and UI Specification, section 6.4 (Service Catalog
-- Management: Add, Edit, Deactivate, Remove) and BR-14 (important actions are logged).
grant delete on public.services to authenticated;

drop policy if exists "services: admin removes inactive" on public.services;
create policy "services: admin removes inactive" on public.services for delete to authenticated
  using ((select public.is_admin()) and not active);
