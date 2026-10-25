-- Replace the first draft descriptions (from migration 20261025100000 as first written) with the owner's wording.
-- Only rows still holding the old draft text change, so anything edited in the admin catalog is kept.
update public.services s
set description = d.final_text
from (values
  ('Leak Detection & Repair', 'We find where water is leaking and fix faucets, pipes and fittings so the problem does not come back.', 'Hidden leaks, dripping fixtures, slab leaks — found and fixed without tearing up your home.'),
  ('Pipe Installation & Repiping', 'New water lines and pipe replacement for kitchens, bathrooms and whole homes.', 'PPR, PVC, and copper installs for new builds, renovations, and full repipes.'),
  ('Drain & Sewer Cleaning', 'Clearing clogged sinks, floor drains, toilets and sewer lines.', 'Clogged kitchen, bath, or main line. We clear it and tell you why it happened.'),
  ('Wiring & Rewiring', 'Safe wiring for new work and replacement of old or faulty wiring.', 'Safe wiring for new rooms, additions, and outdated panels that need to come up to code.'),
  ('Lighting & Outlets', 'Installing and repairing lights, switches and power outlets.', 'Recessed lights, chandeliers, USB outlets, switches — installed clean and level.'),
  ('Emergency Service', 'Urgent help for burst pipes, power faults and other problems that cannot wait. Urgent requests are offered to providers right away.', 'Burst pipes, sparking outlets, total blackouts. Call us anytime — we answer.'),
  ('Painting', 'Interior and exterior painting, from a single room to the whole house.', 'Interior and exterior painting with proper surface prep, quality paint, and clean edges.'),
  ('Waterproofing', 'Sealing roofs, walls, floors and bathrooms against leaks and dampness.', 'Bathrooms, rooftops, basements, and exterior walls sealed against leaks and moisture.'),
  ('House & Condominium Renovation', 'Larger remodeling projects for houses and condominium units. An admin assigns a foreman to oversee the work.', 'Full-scale renovations from demolition to finishing. We manage the trades so you don''t have to.'),
  ('Modular Cabinets', 'Ready-made cabinet systems for kitchens, closets and storage, fitted to your space.', 'Custom-fit modular kitchen, bath, and storage cabinets designed for your space.'),
  ('Roof & Gutter Installation', 'Roof installation and repair, and gutters that carry rainwater away from your home.', 'New roofs, re-roofing, and seamless gutter systems to protect your home from the elements.'),
  ('Carpentry Works', 'Doors, frames, shelves, ceilings and other woodwork built or repaired on site.', 'Doors, frames, moldings, built-ins, and structural woodwork done to specification.'),
  ('Customized Cabinets', 'Cabinets made to your measurements and design.', 'Bespoke cabinetry handcrafted to match your style, layout, and storage needs.')
) as d(name, draft_text, final_text)
where s.name = d.name and s.description = d.draft_text;
