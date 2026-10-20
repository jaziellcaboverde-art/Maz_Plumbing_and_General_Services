import { NextResponse, type NextRequest } from "next/server";
import { decideAccess } from "@/lib/auth/route-access";
import { readSession } from "@/lib/supabase/session";

/** Route guard (step 2.18). Next.js 16 calls this file "proxy". It runs before the page. */
export async function proxy(request: NextRequest) {
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
