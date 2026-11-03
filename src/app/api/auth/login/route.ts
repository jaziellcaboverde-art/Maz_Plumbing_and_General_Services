import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, roleHome } from "@/lib/auth/roles";
import { classifyLoginFailure } from "@/lib/auth/login-failure";
import {
  cookieOptionsFor,
  SESSION_ONLY_COOKIE,
} from "@/lib/auth/session-policy";
import { clientIp, verifyHumanChallenge } from "@/lib/auth/human-verification";
import { getSupabaseEnvStatus, getSupabasePublicEnv } from "@/lib/supabase/env";

type LoginBody = {
  email?: unknown;
  password?: unknown;
  next?: unknown;
  captchaToken?: unknown;
  remember?: unknown;
};

function safeNext(value: unknown): string | null {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : null;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json(
      { ok: false, reason: "invalid_request" },
      { status: 400 },
    );
  }

  if (
    typeof body.email !== "string" ||
    typeof body.password !== "string" ||
    !body.email.trim() ||
    !body.password
  ) {
    return NextResponse.json(
      { ok: false, reason: "invalid_credentials" },
      { status: 400 },
    );
  }

  // Cloudflare Turnstile first, so a bot never reaches the password check.
  if (!(await verifyHumanChallenge(body.captchaToken, clientIp(request.headers)))) {
    return NextResponse.json(
      { ok: false, reason: "captcha_failed" },
      { status: 400 },
    );
  }

  const env = getSupabasePublicEnv();
  if (!env) {
    const reason = getSupabaseEnvStatus();
    console.error(
      `Log in is not configured (${reason}). Check the Supabase values in .env.local; run npm run auth:check.`,
    );
    return NextResponse.json({ ok: false, reason }, { status: 503 });
  }

  const remember = body.remember === true;
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: CookieOptions;
  }> = [];
  try {
    const supabase = createServerClient(env.url, env.anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookiesToSet.push(...cookies);
        },
      },
    });

    function withCookies(response: NextResponse) {
      cookiesToSet.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, cookieOptionsFor(options, !remember)),
      );
      // The marker lets the proxy keep a not-remembered sign in as a session cookie when it refreshes it.
      response.cookies.set(SESSION_ONLY_COOKIE, remember ? "" : "1", {
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        ...(remember ? { maxAge: 0 } : {}),
      });
      return response;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });

    if (error) {
      const reason = classifyLoginFailure(error);
      const status =
        reason === "connection_failed" ||
        reason === "invalid_configuration" ||
        reason === "service_unavailable"
          ? 503
          : reason === "rate_limited"
            ? 429
            : 401;
      if (status === 503)
        console.error(
          `Log in: Supabase returned ${reason}. Check npm run auth:check and server connectivity.`,
        );
      return withCookies(NextResponse.json({ ok: false, reason }, { status }));
    }

    const role = isRole(data.user.app_metadata?.role)
      ? data.user.app_metadata.role
      : "customer";
    const next = safeNext(body.next);
    // Someone who signed up to be a provider goes back to the application, but keeps the customer role until approved.
    const applicant =
      role === "customer" &&
      data.user.user_metadata?.signup_intent === "provider";
    const target =
      applicant && !next?.startsWith("/provider-application")
        ? "/provider-application/submit"
        : (next ?? roleHome(role));
    return withCookies(NextResponse.json({ ok: true, redirectTo: target }));
  } catch (caught) {
    const reason = classifyLoginFailure(caught);
    // Avoid logging user credentials or API keys.
    console.error(
      `Log in: Supabase request failed (${reason}). Run npm run auth:check for a connection diagnosis.`,
    );
    return NextResponse.json(
      {
        ok: false,
        reason:
          reason === "invalid_credentials" ? "service_unavailable" : reason,
      },
      { status: 503 },
    );
  }
}
