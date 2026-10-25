/** Small display helpers shared by the customer, provider and admin screens. */

export function kmAway(distanceM: number | null | undefined): string {
  if (distanceM === null || distanceM === undefined || !Number.isFinite(distanceM)) return "Distance unknown";
  const km = distanceM / 1000;
  return km < 1 ? "Less than 1 km away" : `${km.toFixed(1)} km away`;
}

export function ratingText(stars: number, reviewCount: number): string {
  return reviewCount > 0 ? `${stars.toFixed(1)} stars (${reviewCount} ${reviewCount === 1 ? "review" : "reviews"})` : "No reviews yet";
}

export function pesos(amount: number | null | undefined): string {
  return amount === null || amount === undefined ? "Rate not set" : `₱${amount.toLocaleString("en-PH", { maximumFractionDigits: 0 })} per day`;
}

const timeFormat = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });
const dayFormat = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });

export function timeOnly(iso: string): string { return timeFormat.format(new Date(iso)); }
export function dayAndTime(iso: string): string { return dayFormat.format(new Date(iso)); }
