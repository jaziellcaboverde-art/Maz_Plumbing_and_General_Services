import { NextResponse, type NextRequest } from "next/server";
import { providerRegistrationErrorMessage } from "@/lib/auth/provider-registration";
import { isRole, roleHome } from "@/lib/auth/roles";
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
 * Where a person lands right after sign in. Provider intent is kept in user metadata only for
 * routing; authorization continues to use the service-controlled app_metadata role.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return redirectTo(request, "/login");

  const role = isRole(user.app_metadata?.role) ? user.app_metadata.role : "customer";
  if (role === "admin") return redirectTo(request, roleHome(role));
  if (role === "provider") {
    const { data: provider } = await supabase
      .from("provider_profiles")
      .select("status")
      .eq("profile_id", user.id)
      .maybeSingle();
    return redirectTo(request, provider?.status === "approved" ? "/provider" : "/provider-application/submit");
  }

  const signupIntent = user.user_metadata?.signup_intent;
  const providerIntent = request.nextUrl.searchParams.get("intent") === "provider" || signupIntent === "provider";
  if (providerIntent) {
    if (signupIntent !== "provider") {
      const { error } = await supabase.auth.updateUser({
        data: { ...user.user_metadata, signup_intent: "provider" },
      });
      if (error) {
        console.error("Could not preserve provider signup intent:", error.message);
        return NextResponse.json(
          { error: "Could not preserve your provider application choice. Please try signing in again." },
          { status: 503 },
        );
      }
    }
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch (caught) {
      console.error("Could not initialize provider role assignment:", caught);
      return NextResponse.json(
        { error: "Could not finish setting up your provider account. Please try again." },
        { status: 503 },
      );
    }
    const { error: roleError } = await admin.rpc("register_provider_applicant", { p_user_id: user.id });
    if (roleError) {
      console.error("Could not register provider applicant role:", roleError.code, roleError.message);
      return NextResponse.json(
        { error: providerRegistrationErrorMessage(roleError) },
        { status: 503 },
      );
    }
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("Provider OAuth session refresh failed:", refreshError.message);
      return NextResponse.json(
        { error: "Your provider account was created, but sign-in could not finish. Log in to continue." },
        { status: 503 },
      );
    }
    // The application page routes existing applicants to their status page.
    return redirectTo(request, "/provider-application/submit");
  }
  if (role !== "customer") return redirectTo(request, roleHome(role));

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name,last_name,birthday,mobile")
    .eq("id", user.id)
    .maybeSingle();
  const complete = Boolean(profile?.first_name && profile?.last_name && profile?.birthday && profile?.mobile);
  return redirectTo(request, complete ? roleHome("customer") : "/customer/setup");
}
