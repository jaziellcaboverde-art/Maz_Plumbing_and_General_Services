import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isRole, roleHome } from "@/lib/auth/roles";
import { getSupabasePublicEnv } from "@/lib/supabase/env";

type LoginBody = { email?: unknown; password?: unknown; next?: unknown };

function safeNext(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export async function POST(request: NextRequest) {
  let body: LoginBody;
  try {
    body = await request.json() as LoginBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_request" }, { status: 400 });
  }

  if (typeof body.email !== "string" || typeof body.password !== "string" || !body.email.trim() || !body.password) {
    return NextResponse.json({ ok: false, reason: "invalid_credentials" }, { status: 400 });
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

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: body.email.trim(),
      password: body.password,
    });

    if (error) {
      const unconfirmed = error.code === "email_not_confirmed" || error.message.toLowerCase().includes("email not confirmed");
      const response = NextResponse.json(
        { ok: false, reason: unconfirmed ? "email_not_confirmed" : "invalid_credentials" },
        { status: 401 },
      );
      cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      return response;
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: safeNext(body.next) ?? roleHome(isRole(data.user.app_metadata?.role) ? data.user.app_metadata.role : "customer"),
    });
    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  } catch {
    return NextResponse.json({ ok: false, reason: "service_unavailable" }, { status: 503 });
  }
}
