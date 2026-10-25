import { NextResponse, type NextRequest } from "next/server";
import { isRole, roleHome } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

/** Same rule as /auth/confirm: build the redirect from the address the browser used. */
function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, base));
}

/**
 * Where a person lands right after Google sign in. Customers whose profile is still missing
 * the details the sign up form collects go to the setup screen first. Everyone else goes home.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectTo(request, "/login");

  const role = isRole(user.app_metadata?.role) ? user.app_metadata.role : "customer";
  if (role !== "customer") return redirectTo(request, roleHome(role));

  // Google sign up from "Apply to become a provider". The application page decides what happens next
  // (new applicant, pending, rejected or already a provider).
  if (request.nextUrl.searchParams.get("intent") === "provider") return redirectTo(request, "/provider-application/submit");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,birthday,mobile")
    .eq("id", user.id)
    .maybeSingle();
  const complete = Boolean(profile?.first_name && profile?.last_name && profile?.birthday && profile?.mobile);
  return redirectTo(request, complete ? roleHome("customer") : "/customer/setup");
}
