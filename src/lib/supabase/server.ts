import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabasePublicEnv } from "./env";

/** Supabase client for server components, server actions and route handlers. Acts as the signed in person. */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, which cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
