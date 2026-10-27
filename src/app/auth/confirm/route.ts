import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/** Only paths on this site. Blocks //evil.com and full URLs. */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

/**
 * Build redirects from the address the browser used (localhost, a phone's LAN
 * address, or the real domain). request.url can say 0.0.0.0 in dev, which the
 * browser cannot open.
 */
function redirectTo(request: NextRequest, path: string) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.nextUrl.origin;
  return NextResponse.redirect(new URL(path, base));
}

/**
 * Email links land here (sign up confirmation and password reset).
 * The Supabase email template must link to:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  // Supabase's default email templates verify the link first, then redirect
  // here with a PKCE code. Custom templates may instead send a token hash.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, next);
    console.error("Email link refused (code):", error.message);
  }

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return redirectTo(request, next);
    console.error("Email link refused (token hash):", error.message);
  }
  if (!code && !tokenHash) console.error("Email link had no code or token hash. Check the Supabase email template.");
  return redirectTo(request, "/link-expired");
}