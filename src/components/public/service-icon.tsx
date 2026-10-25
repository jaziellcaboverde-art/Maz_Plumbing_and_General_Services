import {
  Droplets,
  Hammer,
  House,
  Lightbulb,
  PaintRoller,
  Ruler,
  Siren,
  Umbrella,
  Waves,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Plumbing: Droplets,
  Drainage: Waves,
  Electrical: Zap,
  Emergency: Siren,
  Painting: PaintRoller,
  Waterproofing: Umbrella,
  Renovation: Hammer,
  Cabinetry: Ruler,
  Roofing: House,
  Carpentry: Wrench,
};

/** One Lucide icon per service category. Unknown categories get a bulb so a new category never breaks the page. */
export function ServiceIcon({ category, className }: { category: string; className?: string }) {
  const Icon = ICONS[category] ?? Lightbulb;
  return <Icon className={className} aria-hidden="true" />;
}
