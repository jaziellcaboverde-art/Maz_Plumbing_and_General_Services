/** NCR is 16 cities plus Pateros. Coverage stays explicit while the catalog remains admin-managed. */
export const METRO_MANILA_AREAS = [
  "Caloocan", "Las Piñas", "Makati", "Malabon", "Mandaluyong", "Manila", "Marikina",
  "Muntinlupa", "Navotas", "Parañaque", "Pasay", "Pasig", "Quezon City", "San Juan",
  "Taguig", "Valenzuela", "Pateros",
] as const;

export function isMetroManilaArea(value: string): boolean {
  const normalize = (name: string) => name.trim().toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/^(city of|municipality of)\s+/, "");
  const normalizedAreas = new Set(METRO_MANILA_AREAS.map(normalize));
  const normalizedValue = normalize(value);
  return normalizedAreas.has(normalizedValue) || normalizedAreas.has(normalizedValue.replace(/\s+city$/, ""));
}

/** The list name for a city as a map service spells it ("City of Manila", "Quezon City"), or "" if it is not in Metro Manila. */
export function matchMetroManilaArea(value: string | undefined | null): string {
  if (!value) return "";
  const normalize = (name: string) => name.trim().toLocaleLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/^(city of|municipality of)\s+/, "").replace(/\s+city$/, "");
  const wanted = normalize(value);
  return METRO_MANILA_AREAS.find((area) => normalize(area) === wanted) ?? "";
}
