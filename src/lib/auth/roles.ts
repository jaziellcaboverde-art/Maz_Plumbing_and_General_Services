export type Role = "customer" | "provider" | "admin";

export const ROLES: readonly Role[] = ["customer", "provider", "admin"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** The first page for each role. Matches NAV[role].home in nav-config.ts. */
export function roleHome(role: Role): string {
  return `/${role}`;
}
