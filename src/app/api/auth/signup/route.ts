import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, verifyTurnstile } from "@/lib/auth/turnstile";
import { providerRegistrationErrorMessage } from "@/lib/auth/provider-registration";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

type Kind = "customer" | "provider";
type SignupBody = {
  kind?: unknown;
  email?: unknown;
  password?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  birthday?: unknown;
  mobile?: unknown;
  accountType?: unknown;
  businessName?: unknown;
  captchaToken?: unknown;
};

const NEXT_AFTER_CONFIRM: Record<Kind, string> = {
  customer: "/customer/setup",
  provider: "/provider-application/submit",
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The address the browser used, so confirmation links work on localhost, a phone, or the real domain. */
function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/**
 * Create an account (steps 5.2 and 5.8). It runs on the server so Cloudflare Turnstile is
 * checked before Supabase is called. The age and mobile rules are repeated here because the
 * browser checks can be skipped. The database re-checks them again when the profile is saved.
 */
const EMAIL_TAKEN = "This email already has an account. Log in, or use Forgot password if you do not remember it.";

export async function POST(request: NextRequest) {
  let body: SignupBody;
  try {
    body = await request.json() as SignupBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  const kind: Kind | null = body.kind === "customer" || body.kind === "provider" ? body.kind : null;
  const email = text(body.email, 254);
  const password = typeof body.password === "string" ? body.password : "";
  const firstName = text(body.firstName, 100);
  const lastName = text(body.lastName, 100);
  const birthday = text(body.birthday, 10);
  const mobile = text(body.mobile, 20);
  const accountType = body.accountType === "business" ? "business" : "household";
  const businessName = text(body.businessName, 160);

  if (!kind || !email || !firstName || !lastName) {
    return NextResponse.json({ ok: false, reason: "invalid_request", message: "Fill in every required field." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ ok: false, reason: "invalid_request", message: "Use a password of 8 to 72 characters." }, { status: 400 });
  }
  if (!/^\+639\d{9}$/.test(mobile)) {
    return NextResponse.json({ ok: false, reason: "invalid_request", message: "Enter your 10-digit mobile number. It starts with 9." }, { status: 400 });
  }
  const born = new Date(`${birthday}T00:00:00Z`);
  const adult = new Date(born);
  adult.setUTCFullYear(adult.getUTCFullYear() + 18);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(born.valueOf()) || adult > new Date()) {
    return NextResponse.json({
      ok: false,
      reason: "under_18",
      message: kind === "provider" ? "Applicants must be at least 18 years old." : "You must be at least 18 years old to create an account.",
    }, { status: 400 });
  }
  if (kind === "customer" && accountType === "business" && !businessName) {
    return NextResponse.json({ ok: false, reason: "invalid_request", message: "Enter your business name." }, { status: 400 });
  }

  if (!await verifyTurnstile(body.captchaToken, clientIp(request.headers))) {
    return NextResponse.json({ ok: false, reason: "captcha_failed" }, { status: 400 });
  }

  const env = getSupabasePublicEnv();
  if (!env) return NextResponse.json({ ok: false, reason: "service_unavailable" }, { status: 503 });

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookiesToSet.push(...cookies);
      },
    },
  });

  const next = NEXT_AFTER_CONFIRM[kind];
  const metadata: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    birthday,
    mobile,
  };
  if (kind === "provider") metadata.signup_intent = "provider";
  if (kind === "customer") {
    metadata.account_type = accountType;
    metadata.business_name = accountType === "business" ? businessName : null;
  }

  try {
    const admin = kind === "provider" ? createAdminClient() : null;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${originOf(request)}/auth/confirm?next=${next}`, data: metadata },
    });
    if (error) {
      return NextResponse.json({ ok: false, reason: "signup_failed", message: error.message }, { status: 400 });
    }
    // Supabase hides that an email is taken: it answers "success" with a user that has no identities.
    // Stop here so the person is told, instead of waiting for an email that will never come.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json({ ok: false, reason: "email_exists", message: EMAIL_TAKEN }, { status: 409 });
    }

    if (kind === "provider") {
      if (!data.user || !admin) {
        return NextResponse.json({ ok: false, reason: "provider_setup_failed", message: "Could not finish setting up your provider account. Try again." }, { status: 503 });
      }

      const { error: roleError } = await admin.rpc("register_provider_applicant", { p_user_id: data.user.id });
      if (roleError) {
        console.error("Provider role assignment failed:", roleError.code, roleError.message);
        const { error: cleanupError } = await admin.auth.admin.deleteUser(data.user.id);
        if (cleanupError) console.error("Could not remove incomplete provider signup:", cleanupError.message);
        return NextResponse.json({
          ok: false,
          reason: "provider_setup_failed",
          message: providerRegistrationErrorMessage(roleError),
        }, { status: 503 });
      }

      if (data.session) {
        const { error: refreshError } = await supabase.auth.refreshSession(data.session);
        if (refreshError) {
          console.error("Provider signup session refresh failed:", refreshError.message);
          return NextResponse.json({ ok: false, reason: "provider_setup_failed", message: "Your provider account was created, but sign-in could not finish. Log in to continue." }, { status: 503 });
        }
      }
    }

    const response = NextResponse.json({ ok: true, signedIn: Boolean(data.session), redirectTo: next });
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch (caught) {
    console.error("Sign up failed before an answer came back:", caught);
    return NextResponse.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }
}
