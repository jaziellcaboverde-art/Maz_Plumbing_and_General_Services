import type { CookieOptions } from "@supabase/ssr";

/**
 * "Remember me" on the sign in page. When it is not ticked, the sign in cookies carry no
 * expiry, so the browser forgets them when it closes. This marker cookie tells the proxy and
 * the server client to keep doing that when they refresh the session.
 */
export const SESSION_ONLY_COOKIE = "maz_session_only";

export function withoutExpiry(options: CookieOptions): CookieOptions {
  const { maxAge: _maxAge, expires: _expires, ...rest } = options;
  void _maxAge;
  void _expires;
  return rest;
}

export function cookieOptionsFor(options: CookieOptions, sessionOnly: boolean): CookieOptions {
  return sessionOnly ? withoutExpiry(options) : options;
}
