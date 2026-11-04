import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
const route = vi.hoisted(() => ({ path: "/admin/provider-schedules" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
import { RoleNav } from "@/components/layout/role-nav";
import { NAV, navEntries, ROLES } from "@/components/layout/nav-config";

test.each(ROLES)(
  "%s grouping preserves every existing destination once",
  (role) => {
    const slugs = navEntries(role).flatMap((entry) =>
      entry.menu ? entry.children.map((item) => item.slug) : [entry.item.slug],
    );
    expect([...slugs].sort()).toEqual(
      NAV[role].items.map((item) => item.slug).sort(),
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  },
);

test("provider schedules opens its parent and submenus support keyboard toggling", async () => {
  const user = userEvent.setup();
  const view = render(<RoleNav role="admin" />);
  const parent = screen.getByRole("button", { name: "Provider work" });
  expect(parent).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("link", { name: "Schedules" })).toHaveAttribute(
    "href",
    "/admin/provider-schedules",
  );
  expect(screen.getByRole("link", { name: "Schedules" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  parent.focus();
  await user.keyboard("{Enter}");
  expect(parent).toHaveAttribute("aria-expanded", "false");
  expect(
    document.getElementById(parent.getAttribute("aria-controls")!),
  ).toHaveAttribute("data-open", "false");
  route.path = "/admin/provider-work-updates";
  view.rerender(<RoleNav role="admin" />);
  expect(parent).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("link", { name: "Work updates" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
