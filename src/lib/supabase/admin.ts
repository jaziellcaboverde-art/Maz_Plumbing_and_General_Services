import { createClient } from "@supabase/supabase-js";
import { requireSupabasePublicEnv } from "./env";

/**
 * Supabase client with the service role. It skips row level security.
 * Server code only. Never import this file from a client component.
 * Every use that changes money, a status or a role must also write an audit row.
 */
export function createAdminClient() {
  const { url } = requireSupabasePublicEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("Add SUPABASE_SERVICE_ROLE_KEY to .env.local. Server only.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
