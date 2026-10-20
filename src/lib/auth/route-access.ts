import { ROLES, roleHome, type Role } from "./roles";

export type Access = { allow: true } | { allow: false; redirectTo: string };

/** Which role area a path belongs to, or null for public pages. */
export function areaOf(pathname: string): Role | null {
  for (const role of ROLES) {
    if (pathname === `/${role}` || pathname.startsWith(`/${role}/`)) return role;
  }
  return null;
}

/**
 * Route guard rules (step 2.18). Pure, so it can be tested without a browser.
 * - Guests are sent to /login when they open a role area.
 * - A signed in person who opens another role's area is sent to their own home.
 * - A signed in person who opens /login is sent to their own home.
 * Everything else is public.
 */
export function decideAccess(pathname: string, role: Role | null, providerApplicant = false): Access {
  if (pathname === "/provider-application" || pathname.startsWith("/provider-application/")) {
    return { allow: true };
  }
  if (providerApplicant && (pathname === "/login" || pathname.startsWith("/customer") || pathname.startsWith("/provider"))) {
    return { allow: false, redirectTo: "/provider-application" };
  }
  const area = areaOf(pathname);
  if (area) {
    if (!role) return { allow: false, redirectTo: "/login" };
    if (role !== area) return { allow: false, redirectTo: roleHome(role) };
    return { allow: true };
  }
  if (pathname === "/login" && role) return { allow: false, redirectTo: roleHome(role) };
  return { allow: true };
}
