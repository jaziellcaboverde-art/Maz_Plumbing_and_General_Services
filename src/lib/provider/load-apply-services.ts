import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

export type ApplyService = { id: string; category: string; name: string };

/**
 * Active services an applicant can offer, for the one-page apply form. Anyone may read active services
 * (the "services: read active" policy), so this uses the anon key and no cookies, and the result is cached.
 */
export async function loadApplyServices(): Promise<readonly ApplyService[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("public-services");

  const env = getSupabasePublicEnv();
  if (!env) return [];
  try {
    const supabase = createClient(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await supabase.from("services").select("id,category,name").eq("active", true).order("sort_order").order("name");
    if (error || !data) return [];
    return data.map((row) => ({ id: row.id as string, category: row.category as string, name: row.name as string }));
  } catch {
    return [];
  }
}
