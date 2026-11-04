import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { LAUNCH_SERVICES, type PublicService } from "./launch-services";

export const PUBLIC_SERVICES_TAG = "public-services";

/**
 * Active services for the guest page. Anyone may read active services (RLS policy
 * "services: read active"), so this uses the anon key and no cookies, which lets the
 * result be cached for everyone. Only an unconfigured demo uses the launch list.
 * Empty live catalogs stay empty; failures must never resurrect inactive services.
 */
export async function loadPublicServices(): Promise<readonly PublicService[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_SERVICES_TAG);

  const env = getSupabasePublicEnv();
  if (!env) return LAUNCH_SERVICES;
  try {
    const supabase = createClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("services")
      .select(
        "id,category,name,description,starting_price_php,price_note,image_path,sort_order",
      )
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error)
      throw new Error("Could not load the service catalog. Please try again.");
    return (data ?? []).map((row) => ({
      id: row.id as string,
      category: row.category as string,
      name: row.name as string,
      description: (row.description as string | null)?.trim() || "",
      startingPricePhp:
        row.starting_price_php === null ? null : Number(row.starting_price_php),
      priceNote: row.price_note as string | null,
      imageUrl: row.image_path
        ? supabase.storage.from("service-photos").getPublicUrl(row.image_path)
            .data.publicUrl
        : null,
    }));
  } catch {
    throw new Error("Could not load the service catalog. Please try again.");
  }
}
