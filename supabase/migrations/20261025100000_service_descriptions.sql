-- Guest home page: each service gets a short description the owner can edit in the admin catalog.
-- The guest page reads active services (anyone may read them) and shows this text.
alter table public.services add column if not exists description text;
alter table public.services drop constraint if exists services_description_length;
alter table public.services add constraint services_description_length
  check (description is null or char_length(description) <= 400);

-- The owner's wording for the 13 launch services (from the service card). Only fills services that have no description yet,
-- so anything the owner has already written is kept.
update public.services s
set description = d.description
from (values
  ('Leak Detection & Repair', 'Hidden leaks, dripping fixtures, slab leaks — found and fixed without tearing up your home.'),
  ('Pipe Installation & Repiping', 'PPR, PVC, and copper installs for new builds, renovations, and full repipes.'),
  ('Drain & Sewer Cleaning', 'Clogged kitchen, bath, or main line. We clear it and tell you why it happened.'),
  ('Wiring & Rewiring', 'Safe wiring for new rooms, additions, and outdated panels that need to come up to code.'),
  ('Lighting & Outlets', 'Recessed lights, chandeliers, USB outlets, switches — installed clean and level.'),
  ('Emergency Service', 'Burst pipes, sparking outlets, total blackouts. Call us anytime — we answer.'),
  ('Painting', 'Interior and exterior painting with proper surface prep, quality paint, and clean edges.'),
  ('Waterproofing', 'Bathrooms, rooftops, basements, and exterior walls sealed against leaks and moisture.'),
  ('House & Condominium Renovation', 'Full-scale renovations from demolition to finishing. We manage the trades so you don''t have to.'),
  ('Modular Cabinets', 'Custom-fit modular kitchen, bath, and storage cabinets designed for your space.'),
  ('Roof & Gutter Installation', 'New roofs, re-roofing, and seamless gutter systems to protect your home from the elements.'),
  ('Carpentry Works', 'Doors, frames, moldings, built-ins, and structural woodwork done to specification.'),
  ('Customized Cabinets', 'Bespoke cabinetry handcrafted to match your style, layout, and storage needs.')
) as d(name, description)
where s.name = d.name and (s.description is null or btrim(s.description) = '');
