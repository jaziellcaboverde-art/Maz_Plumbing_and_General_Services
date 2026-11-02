import { describe, expect, test } from "vitest";
import { NAV } from "@/components/layout/nav-config";
import { areaOf, decideAccess } from "@/lib/auth/route-access";
import { ROLES, isRole, roleHome } from "@/lib/auth/roles";

describe("roles", () => {
  test("isRole accepts the three roles and nothing else", () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(1)).toBe(false);
  });

  test.each(ROLES)("%s home matches the nav config home", (role) => {
    expect(roleHome(role)).toBe(NAV[role].home);
  });
});

describe("areaOf", () => {
  test("finds the role area for the role home and its pages", () => {
    expect(areaOf("/customer")).toBe("customer");
    expect(areaOf("/customer/bookings")).toBe("customer");
    expect(areaOf("/provider/jobs")).toBe("provider");
    expect(areaOf("/admin/audit-log")).toBe("admin");
  });

  test("public pages and look alike paths are not role areas", () => {
    expect(areaOf("/")).toBeNull();
    expect(areaOf("/login")).toBeNull();
    expect(areaOf("/customers")).toBeNull();
    expect(areaOf("/administrator")).toBeNull();
    expect(areaOf("/auth/confirm")).toBeNull();
  });
});

describe("decideAccess", () => {
  test.each(["/customer", "/customer/bookings", "/provider", "/provider/jobs", "/admin", "/admin/users"])(
    "a guest opening %s is sent to /login",
    (path) => {
      expect(decideAccess(path, null)).toEqual({ allow: false, redirectTo: "/login" });
    },
  );

  test.each(ROLES)("%s can open their own area", (role) => {
    expect(decideAccess(`/${role}`, role)).toEqual({ allow: true });
    expect(decideAccess(`/${role}/settings`, role)).toEqual({ allow: true });
  });

  test("a person who opens another role's area is sent to their own home", () => {
    expect(decideAccess("/admin", "customer")).toEqual({ allow: false, redirectTo: "/customer" });
    expect(decideAccess("/admin/config", "provider")).toEqual({ allow: false, redirectTo: "/provider" });
    expect(decideAccess("/customer", "admin")).toEqual({ allow: false, redirectTo: "/admin" });
    expect(decideAccess("/provider/jobs", "customer")).toEqual({ allow: false, redirectTo: "/customer" });
  });

  test("a signed in person who opens /login is sent to their home", () => {
    expect(decideAccess("/login", "customer")).toEqual({ allow: false, redirectTo: "/customer" });
    expect(decideAccess("/login", "admin")).toEqual({ allow: false, redirectTo: "/admin" });
  });

  test("a guest can open /login", () => {
    expect(decideAccess("/login", null)).toEqual({ allow: true });
  });

  test.each(["/", "/terms", "/privacy", "/forgot-password", "/reset-password", "/link-expired", "/auth/confirm"])(
    "%s is open to guests and signed in people",
    (path) => {
      expect(decideAccess(path, null)).toEqual({ allow: true });
      for (const role of ROLES) expect(decideAccess(path, role)).toEqual({ allow: true });
    },
  );
});
