"use client";

import { usePathname } from "next/navigation";

const AUTH_ROUTES = ["/login", "/signup", "/apply/provider", "/forgot-password", "/reset-password"] as const;

export function PublicShellRouteMarker() {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return <span hidden aria-hidden="true" data-public-auth-screen={isAuthRoute ? "true" : undefined} />;
}