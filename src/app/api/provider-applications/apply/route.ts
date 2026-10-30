import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientIp, verifyTurnstile } from "@/lib/auth/turnstile";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabasePublicEnv } from "@/lib/supabase/env";
import { isPhMobile } from "@/lib/phone";
import { APPLICATION_MAX_BYTES } from "@/lib/provider/documents";
import { submitProviderApplication } from "@/lib/provider/submit-application";

const EMAIL_TAKEN = "This email already has an account. Log in, or use Forgot password if you do not remember it.";

function text(value: FormDataEntryValue | null, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** The address the browser used, so the confirmation link works on localhost, a phone, or the real domain. */
function originOf(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : request.nextUrl.origin;
}

/**
 * One-page provider application. A visitor sends their account details, documents and service details
 * together. The server checks Cloudflare Turnstile, creates the account (Supabase emails the confirmation
 * link), then saves the application as pending for an admin to review. If saving the application fails,
 * the new account is removed so the person can try again with the same email.
 */
export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > APPLICATION_MAX_BYTES) {
    return NextResponse.json({ ok: false, message: "The files are too large to send together. Remove a file or choose smaller ones." }, { status: 413 });
  }
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ ok: false, message: "The submitted form could not be read." }, { status: 400 }); }

  const email = text(form.get("email"), 254);
  const password = typeof form.get("password") === "string" ? String(form.get("password")) : "";
  const firstName = text(form.get("account_first_name"), 100);
  const lastName = text(form.get("account_last_name"), 100);
  const birthday = text(form.get("account_birthday"), 10);
  const mobile = text(form.get("account_mobile"), 20);

  if (!email || !firstName || !lastName) {
    return NextResponse.json({ ok: false, message: "Fill in your name and email." }, { status: 400 });
  }
  if (password.length < 8 || password.length > 72) {
    return NextResponse.json({ ok: false, message: "Use a password of 8 to 72 characters." }, { status: 400 });
  }
  if (!isPhMobile(mobile)) {
    return NextResponse.json({ ok: false, message: "Enter your 10-digit mobile number. It starts with 9." }, { status: 400 });
  }
  const born = new Date(`${birthday}T00:00:00Z`);
  const adult = new Date(born);
  adult.setUTCFullYear(adult.getUTCFullYear() + 18);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday) || Number.isNaN(born.valueOf()) || adult > new Date()) {
    return NextResponse.json({ ok: false, reason: "under_18", message: "Applicants must be at least 18 years old." }, { status: 400 });
  }
  if (!await verifyTurnstile(form.get("captchaToken"), clientIp(request.headers))) {
    return NextResponse.json({ ok: false, reason: "captcha_failed", message: "The check did not pass. Try it again." }, { status: 400 });
  }

  const env = getSupabasePublicEnv();
  if (!env) return NextResponse.json({ ok: false, message: "The service is unavailable. Try again later." }, { status: 503 });

  const cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }> = [];
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => { cookiesToSet.push(...cookies); },
    },
  });

  const admin = createAdminClient();
  let userId: string;
  let signedIn = false;
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${originOf(request)}/auth/confirm?next=/provider-application`,
        data: { first_name: firstName, last_name: lastName, birthday, mobile },
      },
    });
    if (error || !data.user) {
      return NextResponse.json({ ok: false, message: error?.message ?? "Could not create your account. Try again." }, { status: 400 });
    }
    // Supabase hides that an email is taken: it answers "success" with a user that has no identities.
    if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return NextResponse.json({ ok: false, reason: "email_exists", message: EMAIL_TAKEN }, { status: 409 });
    }
    userId = data.user.id;
    signedIn = Boolean(data.session);
  } catch {
    return NextResponse.json({ ok: false, message: "The service is unavailable. Try again later." }, { status: 503 });
  }

  let result: Response;
  try {
    result = await submitProviderApplication({
      admin,
      userId,
      userMetadata: { first_name: firstName, last_name: lastName, birthday, mobile },
      form,
    });
  } catch (caught) {
    console.error("Provider application failed after account creation:", caught instanceof Error ? caught.message : caught);
    result = Response.json({ error: "Could not save your application. Try again." }, { status: 500 });
  }
  const body = await result.json().catch(() => ({})) as { ok?: boolean; error?: string; reference?: string };

  if (!result.ok || !body.ok) {
    // Nothing was saved, so remove the new account. The person can fix the form and apply again.
    const { error: removeError } = await admin.auth.admin.deleteUser(userId);
    if (removeError) console.error("Could not remove the account after a failed application:", removeError.message);
    return NextResponse.json({ ok: false, message: body.error ?? "Could not save your application. Try again." }, { status: result.status >= 400 ? result.status : 500 });
  }

  const response = NextResponse.json({ ok: true, reference: body.reference, email, signedIn }, { status: 201 });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}
