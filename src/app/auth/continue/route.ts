import { NextResponse, type NextRequest } from "next/server";
import { isRole, roleHome } from "@/lib/auth/roles";
import { providerRegistrationErrorMessage } from "@/lib/auth/provider-registration";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // Provider signup, from the email form (stored in the account) or from Google (the ?intent=provider link).
  // The account stays a customer until the admin approves the application. This only registers the applicant.
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const askedForProvider = request.nextUrl.searchParams.get("intent") === "provider";
  if (askedForProvider || metadata.signup_intent === "provider") {
    if (metadata.signup_intent !== "provider") {
      const { error } = await supabase.auth.updateUser({ data: { ...metadata, signup_intent: "provider" } });
      if (error) {
        console.error("Could not preserve provider signup intent:", error.message);
        return NextResponse.json(
          { error: "Could not preserve your provider application choice. Please try signing in again." },
          { status: 503 },
        );
      }
    }
    const { error } = await createAdminClient().rpc("register_provider_applicant", { p_user_id: user.id });
    if (error) {
      console.error("Could not register provider applicant:", error.message);
      return NextResponse.json({ error: providerRegistrationErrorMessage(error) }, { status: 503 });
    }
    await supabase.auth.refreshSession();
    return redirectTo(request, "/provider-application/submit");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,birthday,mobile")
    .eq("id", user.id)
    .maybeSingle();
  const complete = Boolean(profile?.first_name && profile?.last_name && profile?.birthday && profile?.mobile);
  return redirectTo(request, complete ? roleHome("customer") : "/customer/setup");
}
