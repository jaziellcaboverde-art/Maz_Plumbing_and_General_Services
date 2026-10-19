import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "./env";

/** Supabase client for client components. Uses the signed in person's session. */
export function createClient() {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
