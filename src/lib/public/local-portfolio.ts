import images from "./portfolio-images.json";
import type { PortfolioPhoto } from "./service-details";

const groups: Record<string, (keyof typeof images)[]> = {
  "Leak Detection & Repair": ["Plumbing"],
  "Pipe Installation & Repiping": ["Motor Pump Installation Storage Tank Installation Repiping Works", "Plumbing"],
  "Drain & Sewer Cleaning": ["Drain & Sewer Cleaning"],
  "Wiring & Rewiring": ["Electrical works"],
  "Lighting & Outlets": ["Electrical works"],
  Waterproofing: ["Waterproofing"],
  "House & Condominium Renovation": ["House Renovation", "Kitchen Renovation", "flooring"],
  "Modular Cabinets": ["Modular Cabinets"],
  "Customized Cabinets": ["Modular Cabinets"],
  "Roof & Gutter Installation": ["Roof and Gutter Installation"],
  "Carpentry Works": ["Carpentry works"],
};

export function localPortfolio(name: string): PortfolioPhoto[] {
  const seen = new Set<string>();
  return (groups[name] ?? []).flatMap(group => images[group].flatMap(imageUrl => {
    const filename = imageUrl.split("/").at(-1)!;
    if (seen.has(filename)) return [];
    seen.add(filename);
    return [{ id: imageUrl, imageUrl, caption: `${group} · Portfolio photo`, sort_order: seen.size }];
  }));
}
