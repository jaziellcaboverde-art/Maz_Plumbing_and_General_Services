import { describe, expect, test } from "vitest";
import { NAV, ROLES, findSection, itemHref } from "@/components/layout/nav-config";

describe("nav config (step 1.20)", () => {
  test.each(ROLES)("%s links all live under the role path and are unique", (role) => {
    const hrefs = NAV[role].items.map((i) => itemHref(role, i));
    for (const href of hrefs) expect(href.startsWith(NAV[role].home)).toBe(true);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  test.each(ROLES)("%s has exactly one home item and it comes first", (role) => {
    const items = NAV[role].items;
    expect(items.filter((i) => i.slug === "")).toHaveLength(1);
    expect(items[0].slug).toBe("");
  });

  test("customer and provider show 4 tabs, admin shows 4 plus overflow behind More", () => {
    expect(NAV.customer.items).toHaveLength(4);
    expect(NAV.provider.items).toHaveLength(4);
    const admin = NAV.admin.items;
    expect(admin.filter((i) => !i.overflow)).toHaveLength(4);
    expect(admin.filter((i) => i.overflow).length).toBeGreaterThan(0);
  });

  test("tab labels follow the wireframes", () => {
    expect(NAV.customer.items.map((i) => i.label)).toEqual(["Home", "Bookings", "Chat", "Settings"]);
    expect(NAV.provider.items.map((i) => i.label)).toEqual(["Offers", "Jobs", "Chat", "Earnings"]);
    expect(NAV.admin.items.slice(0, 4).map((i) => i.label)).toEqual([
      "Needs action",
      "Bookings",
      "Users",
      "Config",
    ]);
  });

  test("findSection resolves placeholders and skips home and settings", () => {
    expect(findSection("customer", "bookings")?.label).toBe("Bookings");
    expect(findSection("customer", "settings")).toBeUndefined();
    expect(findSection("provider", "")?.label).toBe("Offers");
    expect(findSection("admin", "nope")).toBeUndefined();
  });
});
