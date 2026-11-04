import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NAV } from "@/components/layout/nav-config";

describe("navigation separation", () => {
  test.each(["customer", "provider", "admin"] as const)(
    "%s sidebar has no redundant account or notification links",
    (role) => {
      const blocked = new Set([
        "notifications",
        "settings",
        "profile",
        "addresses",
        "profile & addresses",
      ]);
      for (const item of NAV[role].items) {
        expect(blocked.has(item.label.toLowerCase())).toBe(false);
        expect(blocked.has(item.slug.toLowerCase())).toBe(false);
      }
    },
  );

  test("messages are available in every header without duplicate sidebar links", () => {
    for (const role of ["customer", "provider", "admin"] as const) {
      expect(NAV[role].items.some((item) => item.slug === "chat")).toBe(false);
    }
    const shell = readFileSync(
      join(process.cwd(), "src/components/layout/app-shell.tsx"),
      "utf8",
    );
    expect(shell).toContain("href={`${NAV[role].home}/chat`}");
    expect(shell).toContain("<NotificationBell role={role} />");
  });

  test("sidebar navigation scrolls independently of pinned settings and logout", () => {
    const shell = readFileSync(
      join(process.cwd(), "src/components/layout/collapsible-workspace.tsx"),
      "utf8",
    );
    expect(shell).toMatch(
      /className=\{styles\.sidebarScroll\}\s+data-sidebar-scroll-region>\s*\{sidebar\}/,
    );
    expect(shell).toMatch(
      /className=\{styles\.sidebarFooter\}\s+data-sidebar-fixed-footer>\s*\{footer\}/,
    );
    const css = readFileSync(
      join(process.cwd(), "src/components/layout/shell.module.css"),
      "utf8",
    );
    expect(css).toContain("overflow-y: auto;");
    expect(css).toContain("flex: none;");
    expect(css).toMatch(/grid-template-rows: minmax\(0,\s*1fr\)/);
    const appShell = readFileSync(
      join(process.cwd(), "src/components/layout/app-shell.tsx"),
      "utf8",
    );
    expect(appShell).toContain("<LogoutButton />");
    expect(appShell).toContain("href={`${NAV[role].home}/profile`}");
    expect(appShell).toContain("<ShellSettingsLink");
    expect(css).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
  });
});
