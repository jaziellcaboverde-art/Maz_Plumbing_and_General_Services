import { matchMetroManilaArea } from "./metro-manila";
import { METRO_MANILA_BARANGAYS } from "./metro-manila-barangays";

/** What a map lookup fills into the address form. Empty text means "could not tell". */
export type AddressParts = { line1: string; barangay: string; city: string };

/** The fields of a Geoapify result that the address form can use. */
export type GeoapifyAddress = {
  name?: string;
  housenumber?: string;
  street?: string;
  suburb?: string;
  district?: string;
  quarter?: string;
  neighbourhood?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state_district?: string;
  address_line1?: string;
};

function plain(value: string): string {
  return value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(barangay|brgy)\b\.?/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

/** The barangay in the city's list that matches a map name, or "". */
export function matchBarangay(city: string, candidates: Array<string | undefined>): string {
  const list = METRO_MANILA_BARANGAYS[city] ?? [];
  const byPlain = new Map(list.map((name) => [plain(name), name]));
  for (const candidate of candidates) {
    if (!candidate) continue;
    const hit = byPlain.get(plain(candidate));
    if (hit) return hit;
  }
  return "";
}

export function addressPartsFrom(raw: GeoapifyAddress): AddressParts {
  const city = [raw.city, raw.town, raw.municipality, raw.county, raw.state_district, raw.city_district, raw.district, raw.suburb]
    .map(matchMetroManilaArea).find(Boolean) ?? "";
  const barangay = city
    ? matchBarangay(city, [raw.suburb, raw.district, raw.quarter, raw.neighbourhood, raw.village, raw.city_district, raw.name])
    : "";
  const street = [raw.housenumber, raw.street].filter(Boolean).join(" ").trim();
  const place = (raw.name ?? "").trim();
  // address_line1 can just repeat the barangay or city, which is not a street.
  const line = (raw.address_line1 ?? "").trim();
  const repeatsArea = [city, barangay, raw.suburb, raw.district].some((area) => area && plain(area) === plain(line));
  const line1 = street || place || (repeatsArea ? "" : line);
  return { line1, barangay, city };
}
