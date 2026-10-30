import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, type Role } from "@/lib/auth/roles";
import { cookieOptionsFor, SESSION_ONLY_COOKIE } from "@/lib/auth/session-policy";
import { getSupabasePublicEnv } from "./env";

/**
 * Refreshes the session cookie and reads the role from the signed token.
 * Returns the response to send back (with fresh cookies) and the role, or null for a guest.
 * If Supabase is not set up yet, nobody is signed in, so role area pages send people to /login.
 */
export async function readSession(request: NextRequest): Promise<{ response: NextResponse; role: Role | null; providerApplicant: boolean }> {
  let response = NextResponse.next({ request });
  const env = getSupabasePublicEnv();
  if (!env) return { response, role: null, providerApplicant: false };

  const sessionOnly = request.cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, cookieOptionsFor(options, sessionOnly)));
      },
    },
  });

  // getClaims checks the token signature. Do not replace it with getSession in server code.
  let { data } = await supabase.auth.getClaims();
  const hasRoleClaim = (claims: unknown) => isRole((claims as { app_metadata?: { role?: unknown } } | undefined)?.app_metadata?.role);
  // Signed in but the token has no role yet. This happens right after a first Google sign in, because the
  // role is added by a database trigger after the token is made. Refresh once so the token gets the role,
  // instead of treating a signed in customer as a guest.
  if ((data?.claims as { sub?: string } | undefined)?.sub && !hasRoleClaim(data?.claims)) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error) ({ data } = await supabase.auth.getClaims());
  }
  const appMetadata = (data?.claims as { app_metadata?: { role?: unknown } } | undefined)?.app_metadata;
  let role = isRole(appMetadata?.role) ? appMetadata.role : null;
  const subject = (data?.claims as { sub?: string } | undefined)?.sub;
  let providerApplicant = false;
  const pathname = request.nextUrl.pathname;
  if (role === "provider" && subject) {
    const { data: provider } = await supabase
      .from("provider_profiles")
      .select("status")
      .eq("profile_id", subject)
      .maybeSingle();
    if (provider?.status !== "approved") role = "customer";
  }
  const needsApplicantGuard = pathname === "/login" || pathname.startsWith("/customer") ||
    (pathname.startsWith("/provider") && !pathname.startsWith("/provider-application"));
  if (role === "customer" && subject && needsApplicantGuard) {
    const { data: application } = await supabase
      .from("provider_profiles")
      .select("status")
      .eq("profile_id", subject)
      .in("status", ["pending", "rejected"])
      .maybeSingle();
    providerApplicant = Boolean(application);
  }
  return { response, role, providerApplicant };
}
