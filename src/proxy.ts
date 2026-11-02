import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/auth/route-access";
import { readSession } from "@/lib/supabase/session";

/** Route guard (step 2.18). Next.js 16 calls this file "proxy". It runs before the page. */
export async function proxy(request: NextRequest) {
  // A Google sign in that came back to the site root with a code (the redirect URL was not on the Supabase
  // allow list) still has to be finished. Hand the code to /auth/confirm instead of dropping it.
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/" && searchParams.get("code") && !searchParams.get("error")) {
    const target = new URL("/auth/confirm", request.url);
    target.searchParams.set("code", searchParams.get("code")!);
    target.searchParams.set("next", "/auth/continue");
    return NextResponse.redirect(target);
  }

  const { response, role, providerApplicant } = await readSession(request);
  const access = decideAccess(request.nextUrl.pathname, role, providerApplicant);
  if (access.allow) return response;

  const redirect = NextResponse.redirect(new URL(access.redirectTo, request.url));
  // Keep any refreshed session cookies on the redirect.
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Skip static files and images. Everything else passes through the guard.
  matcher: ["/((?!api/auth/login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
