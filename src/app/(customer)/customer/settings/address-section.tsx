import { AddressSettings, type AddressItem } from "@/components/ui/address-settings";
import { createClient } from "@/lib/supabase/server";

/** The geography column comes back as GeoJSON. Anything else means the pin could not be read. */
function pointOf(location: unknown): AddressItem["point"] {
  if (!location || typeof location !== "object" || !("coordinates" in location)) return undefined;
  const [longitude, latitude] = (location as { coordinates: unknown }).coordinates as number[];
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined;
}

export async function AddressSection() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: rows }, { data: used }] = await Promise.all([
    supabase.from("addresses").select("id,label,line1,barangay,city,landmark,location").eq("profile_id", user.id).order("created_at"),
    // A draft can lose its address safely. A submitted, unfinished booking cannot.
    supabase.from("bookings").select("address_id").eq("customer_id", user.id)
      .not("address_id", "is", null).not("status", "in", "(draft,completed,cancelled)"),
  ]);
  const inUse = new Set((used ?? []).map((row) => row.address_id as string));
  const items: AddressItem[] = (rows ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string | null,
    line1: row.line1 as string,
    barangay: row.barangay as string | null,
    city: row.city as string,
    landmark: row.landmark as string | null,
    hasPin: Boolean(row.location),
    point: pointOf(row.location),
    inUse: inUse.has(row.id as string),
  }));
  return <AddressSettings initialAddresses={items} />;
}
