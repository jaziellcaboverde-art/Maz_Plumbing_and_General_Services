import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { LAUNCH_SERVICES, type PublicService } from "./launch-services";

export const PUBLIC_SERVICES_TAG = "public-services";

/**
 * Active services for the guest page. Anyone may read active services (RLS policy
 * "services: read active"), so this uses the anon key and no cookies, which lets the
 * result be cached for everyone. If Supabase is not set up, or the description column
 * does not exist yet, the launch list is used so the page never breaks.
 */
export async function loadPublicServices(): Promise<readonly PublicService[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(PUBLIC_SERVICES_TAG);

  const env = getSupabasePublicEnv();
  if (!env) return LAUNCH_SERVICES;
  try {
    const supabase = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase
      .from("services")
      .select("category,name,description,sort_order")
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error || !data?.length) return LAUNCH_SERVICES;
    const fallback = new Map(LAUNCH_SERVICES.map((service) => [service.name, service.description]));
    return data.map((row) => ({
      category: row.category as string,
      name: row.name as string,
      description: (row.description as string | null)?.trim() || fallback.get(row.name as string) || "",
    }));
  } catch {
    return LAUNCH_SERVICES;
  }
}
