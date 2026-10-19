import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, type Role } from "@/lib/auth/roles";
import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the session cookie and reads the role from the signed token.
 * Returns the response to send back (with fresh cookies) and the role, or null for a guest.
 * If Supabase is not set up yet, nobody is signed in, so role area pages send people to /login.
 */
export async function readSession(request: NextRequest): Promise<{ response: NextResponse; role: Role | null }> {
  let response = NextResponse.next({ request });
  const env = getSupabasePublicEnv();
  if (!env) return { response, role: null };

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims checks the token signature. Do not replace it with getSession in server code.
  const { data } = await supabase.auth.getClaims();
  const appMetadata = (data?.claims as { app_metadata?: { role?: unknown } } | undefined)?.app_metadata;
  const role = isRole(appMetadata?.role) ? appMetadata.role : null;
  return { response, role };
}
