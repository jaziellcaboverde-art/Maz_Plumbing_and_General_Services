import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookieOptionsFor, SESSION_ONLY_COOKIE } from "@/lib/auth/session-policy";
import { requireSupabasePublicEnv } from "./env";

/** Supabase client for server components, server actions and route handlers. Acts as the signed in person. */
export async function createClient() {
  const cookieStore = await cookies();
  const sessionOnly = cookieStore.get(SESSION_ONLY_COOKIE)?.value === "1";
  const { url, anonKey } = requireSupabasePublicEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, cookieOptionsFor(options, sessionOnly)));
        } catch {
          // Called from a server component, which cannot set cookies. The proxy refreshes the session instead.
        }
      },
    },
  });
}
