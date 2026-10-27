/**
 * The launch service list from the client (Q22, phases-plan.md step 6.1).
 * It is the fallback for the guest page. The live list comes from the services table
 * (admin catalog) and these descriptions are also seeded by migration 20261025100000.
 * Descriptions are the owner's own wording from the service card.
 */
export type PublicService = {
  id?: string;
  category: string;
  name: string;
  description: string;
  startingPricePhp?: number | null;
  priceNote?: string | null;
};

export const LAUNCH_SERVICES: readonly PublicService[] = [
  {
    category: "Plumbing",
    name: "Leak Detection & Repair",
    description: "Hidden leaks, dripping fixtures, slab leaks — found and fixed without tearing up your home.",
  },
  {
    category: "Plumbing",
    name: "Pipe Installation & Repiping",
    description: "PPR, PVC, and copper installs for new builds, renovations, and full repipes.",
  },
  {
    category: "Drainage",
    name: "Drain & Sewer Cleaning",
    description: "Clogged kitchen, bath, or main line. We clear it and tell you why it happened.",
  },
  {
    category: "Electrical",
    name: "Wiring & Rewiring",
    description: "Safe wiring for new rooms, additions, and outdated panels that need to come up to code.",
  },
  {
    category: "Electrical",
    name: "Lighting & Outlets",
    description: "Recessed lights, chandeliers, USB outlets, switches — installed clean and level.",
  },
  {
    category: "Emergency",
    name: "Emergency Service",
    description: "Burst pipes, sparking outlets, total blackouts. Call us anytime — we answer.",
  },
  {
    category: "Painting",
    name: "Painting",
    description: "Interior and exterior painting with proper surface prep, quality paint, and clean edges.",
  },
  {
    category: "Waterproofing",
    name: "Waterproofing",
    description: "Bathrooms, rooftops, basements, and exterior walls sealed against leaks and moisture.",
  },
  {
    category: "Renovation",
    name: "House & Condominium Renovation",
    description: "Full-scale renovations from demolition to finishing. We manage the trades so you don't have to.",
  },
  {
    category: "Cabinetry",
    name: "Modular Cabinets",
    description: "Custom-fit modular kitchen, bath, and storage cabinets designed for your space.",
  },
  {
    category: "Roofing",
    name: "Roof & Gutter Installation",
    description: "New roofs, re-roofing, and seamless gutter systems to protect your home from the elements.",
  },
  {
    category: "Carpentry",
    name: "Carpentry Works",
    description: "Doors, frames, moldings, built-ins, and structural woodwork done to specification.",
  },
  {
    category: "Cabinetry",
    name: "Customized Cabinets",
    description: "Bespoke cabinetry handcrafted to match your style, layout, and storage needs.",
  },
];
