import { describe, expect, test } from "vitest";
import {
  NAV,
  ROLES,
  findSection,
  itemHref,
} from "@/components/layout/nav-config";

describe("nav config (step 1.20)", () => {
  test.each(ROLES)(
    "%s links all live under the role path and are unique",
    (role) => {
      const hrefs = NAV[role].items.map((i) => itemHref(role, i));
      for (const href of hrefs)
        expect(href.startsWith(NAV[role].home)).toBe(true);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    },
  );

  test.each(ROLES)(
    "%s has exactly one home item and it comes first",
    (role) => {
      const items = NAV[role].items;
      expect(items.filter((i) => i.slug === "")).toHaveLength(1);
      expect(items[0].slug).toBe("");
    },
  );

  test("each role keeps 4 primary phone tabs and moves supporting tools behind More", () => {
    for (const role of ROLES) {
      expect(NAV[role].items.filter((i) => !i.overflow)).toHaveLength(4);
      expect(
        NAV[role].items.filter((i) => i.overflow).length,
      ).toBeGreaterThanOrEqual(0);
    }
  });

  test("tab labels follow the wireframes", () => {
    expect(NAV.customer.items.slice(0, 4).map((i) => i.label)).toEqual([
      "Dashboard",
      "Book a Service",
      "My bookings",
      "Service History",
    ]);
    expect(NAV.provider.items.slice(0, 4).map((i) => i.label)).toEqual([
      "Dashboard",
      "Offers",
      "Assignments",
      "Schedule",
    ]);
    expect(NAV.admin.items.slice(0, 4).map((i) => i.label)).toEqual([
      "Dashboard",
      "Bookings",
      "Assignments",
      "Create booking",
    ]);
  });

  test("customer booking navigation opens three distinct pages and excludes notifications", () => {
    const customer = NAV.customer.items;
    expect(
      customer.some((item) =>
        ["Notifications", "Profile & addresses"].includes(item.label),
      ),
    ).toBe(false);
    expect(
      NAV.admin.items.some((item) =>
        ["Notifications", "Chat", "Settings"].includes(item.label),
      ),
    ).toBe(false);
    expect(customer.find((item) => item.label === "Book a Service")?.slug).toBe(
      "bookings/new",
    );
    expect(customer.find((item) => item.label === "My bookings")?.slug).toBe(
      "bookings",
    );
    expect(
      customer.find((item) => item.label === "Service History")?.slug,
    ).toBe("bookings/history");
    expect(
      new Set(customer.slice(1, 4).map((item) => itemHref("customer", item)))
        .size,
    ).toBe(3);
  });

  test("sidebar keeps account tools and notifications out of role navigation", () => {
    for (const role of ROLES) {
      expect(
        NAV[role].items.some((item) =>
          [
            "Notifications",
            "Settings",
            "Profile",
            "Profile & addresses",
          ].includes(item.label),
        ),
      ).toBe(false);
    }
    expect(NAV.admin.items.some((item) => item.label === "Chat")).toBe(false);
    expect(NAV.customer.items.map((item) => item.label)).toEqual([
      "Dashboard",
      "Book a Service",
      "My bookings",
      "Service History",
      "Services",
    ]);
  });

  test("findSection resolves placeholders and skips home and settings", () => {
    expect(findSection("customer", "bookings")?.label).toBe("My bookings");
    expect(findSection("customer", "settings")).toBeUndefined();
    expect(findSection("provider", "")?.label).toBe("Dashboard");
    expect(findSection("admin", "nope")).toBeUndefined();
  });
});
