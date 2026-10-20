-- Replace the temporary sample catalog with the client's confirmed launch services.
-- Existing sample rows are retained for historical/provider references but hidden
-- from new bookings.
update public.services
set active = false
where (category, name) in (
  ('Plumbing', 'Leak repair'),
  ('Electrical', 'Outlet and switch repair'),
  ('Aircon', 'Aircon cleaning'),
  ('Painting', 'Room repaint'),
  ('Renovation', 'Kitchen renovation')
);

insert into public.services (category, name, default_class, urgent_allowed, active, sort_order)
values
  ('Plumbing', 'Leak Detection & Repair', 'minor', false, true, 1),
  ('Plumbing', 'Pipe Installation & Repiping', 'minor', false, true, 2),
  ('Drainage', 'Drain & Sewer Cleaning', 'minor', false, true, 3),
  ('Electrical', 'Wiring & Rewiring', 'minor', false, true, 4),
  ('Electrical', 'Lighting & Outlets', 'minor', false, true, 5),
  ('Emergency', 'Emergency Service', 'minor', true, true, 6),
  ('Painting', 'Painting', 'minor', false, true, 7),
  ('Waterproofing', 'Waterproofing', 'minor', false, true, 8),
  ('Renovation', 'House & Condominium Renovation', 'major', false, true, 9),
  ('Cabinetry', 'Modular Cabinets', 'minor', false, true, 10),
  ('Roofing', 'Roof & Gutter Installation', 'minor', false, true, 11),
  ('Carpentry', 'Carpentry Works', 'minor', false, true, 12),
  ('Cabinetry', 'Customized Cabinets', 'minor', false, true, 13)
on conflict (category, name) do update
set default_class = excluded.default_class,
    urgent_allowed = excluded.urgent_allowed,
    active = excluded.active,
    sort_order = excluded.sort_order;
