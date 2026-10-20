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
