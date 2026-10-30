import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { OAUTH_NEXT_COOKIE, safeNextPath } from "@/lib/auth/oauth";
import { createClient } from "@/lib/supabase/server";

const TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

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
 * Email links and Google sign in land here.
 * - Email: the Supabase template links to
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next=<path>
 * - Google: the redirect URL is exactly {site}/auth/confirm (no query string, so it matches the Supabase
 *   allow list). The page to open next is in the maz_oauth_next cookie set by the Google button.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const cookieNext = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  const next = safeNextPath(searchParams.get("next") ?? (cookieNext ? decodeURIComponent(cookieNext) : null));
  const finish = (path: string) => {
    const response = redirectTo(request, path);
    response.cookies.delete(OAUTH_NEXT_COOKIE);
    return response;
  };

  // Google (or the user) said no, for example they pressed Cancel on the Google screen.
  if (searchParams.get("error")) return finish("/login?google=failed");

  // Supabase's default email templates verify the link first, then redirect
  // here with a PKCE code. Custom templates may instead send a token hash.
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // A brand new Google account gets its role (customer) from a database trigger that runs right
      // after the account is created, so the first token has no role in it and the route guard would
      // send the person straight back to /login. Refreshing reads the account again and mints a token
      // that has the role.
      await supabase.auth.refreshSession().catch(() => undefined);
      return finish(next);
    }
  }

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return finish(next);
  }
  // A Google attempt (it has the cookie) goes back to the login page with a message. An old email link keeps the expired-link page.
  return finish(cookieNext ? "/login?google=failed" : "/link-expired");
}
