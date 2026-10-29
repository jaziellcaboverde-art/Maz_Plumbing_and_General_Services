import { cleanup, render, screen, within } from "@testing-library/react";
import Link from "next/link";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { PublicShell } from "@/components/layout/public-shell";
import { RoleNav } from "@/components/layout/role-nav";
import { NAV, ROLES } from "@/components/layout/nav-config";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));
// AppShell reads the signed in profile on the server. A signed out stub is enough for layout tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
  }),
}));
vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <Link href="/notifications" aria-label="Notifications" />,
}));

afterEach(cleanup);

function nav() {
  return screen.getByRole("navigation", { name: "Main" });
}

describe("RoleNav", () => {
  test.each(ROLES)("%s renders every configured item in order", (role) => {
    pathname.value = NAV[role].home;
    render(<RoleNav identityName="Test User" identityRole="Test role" role={role} />);
    // The brand link sits first in the nav. The tabs are the links marked data-sidebar-nav-link.
    const names = within(nav())
      .getAllByRole("link")
      .filter((a) => a.hasAttribute("data-sidebar-nav-link"))
      .map((a) => a.textContent);
    const expected = NAV[role].items.map((i) => i.label);
    expect(names.slice(0, expected.length)).toEqual(expected);
  });

  test("admin gets a More link for phones, customer and provider do not", () => {
    pathname.value = "/admin";
    const { unmount } = render(<RoleNav identityName="Test User" identityRole="Test role" role="admin" />);
    expect(within(nav()).getByRole("link", { name: "More" })).toHaveAttribute("href", "/admin/more");
    unmount();
    for (const role of ["customer", "provider"] as const) {
      pathname.value = NAV[role].home;
      const r = render(<RoleNav identityName="Test User" identityRole="Test role" role={role} />);
      expect(within(nav()).queryByRole("link", { name: "More" })).toBeNull();
      r.unmount();
    }
  });

  test("home is current only on its exact path", () => {
    pathname.value = "/customer";
    render(<RoleNav identityName="Test User" identityRole="Test role" role="customer" />);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Bookings" })).not.toHaveAttribute("aria-current");
  });

  test("a nested path keeps its tab current and clears home", () => {
    pathname.value = "/customer/bookings/42";
    render(<RoleNav identityName="Test User" identityRole="Test role" role="customer" />);
    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  test("an admin overflow page marks both its own link and More as current", () => {
    pathname.value = "/admin/audit-log";
    render(<RoleNav identityName="Test User" identityRole="Test role" role="admin" />);
    expect(screen.getByRole("link", { name: "Audit log" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "More" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Needs action" })).not.toHaveAttribute("aria-current");
  });
});

describe("AppShell", () => {
  test.each(ROLES)("%s shell has one header, one nav, one main and a skip link", async (role) => {
    pathname.value = NAV[role].home;
    render(await AppShell({ role, children: <p>Page content</p> }));
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main");
    expect(within(main).getByText("Page content")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveAttribute("href", "#main");
  });

  test.each(ROLES)("%s logo goes home and Settings opens that role's settings", async (role) => {
    pathname.value = NAV[role].home;
    render(await AppShell({ role, children: <p>x</p> }));
    expect(within(screen.getByRole("banner")).getByRole("link", { name: "MAZ Plumbing and General Services" })).toHaveAttribute("href", NAV[role].home);
    // Settings moved out of the header into the sidebar (customer has it as a tab). There is exactly one.
    const settingsLink = screen.getByRole("link", { name: "Settings" });
    expect(settingsLink).toHaveAttribute("href", `${NAV[role].home}/settings`);
    expect(within(screen.getByRole("banner")).queryByRole("link", { name: "Settings" })).toBeNull();
    expect(within(screen.getByRole("banner")).queryByRole("link", { name: "Text size" })).toBeNull();
  });
});

describe("PublicShell", () => {
  test("has Log in and Sign up in the header and the legal links in the footer", () => {
    pathname.value = "/";
    render(
      <PublicShell>
        <p>Home</p>
      </PublicShell>,
    );
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(within(header).getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    const footerLinks = within(screen.getByRole("contentinfo")).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(footerLinks).toEqual(expect.arrayContaining(["/terms", "/privacy", "/cancellation"]));
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  test.each(["/login", "/signup", "/apply/provider", "/forgot-password", "/reset-password"])(
    "marks %s as an auth route",
    (route) => {
      pathname.value = route;
      const { container } = render(<PublicShell><p>Auth page</p></PublicShell>);
      expect(container.querySelector('[data-public-auth-screen="true"]')).not.toBeNull();
    },
  );

  test("clears the auth route marker when client navigation returns home", () => {
    pathname.value = "/login";
    const { container, rerender } = render(<PublicShell><p>Auth page</p></PublicShell>);
    expect(container.querySelector('[data-public-auth-screen="true"]')).not.toBeNull();

    pathname.value = "/";
    rerender(<PublicShell><p>Home</p></PublicShell>);
    expect(container.querySelector('[data-public-auth-screen="true"]')).toBeNull();
  });

  test("shows only business facts the owner has confirmed", () => {
    pathname.value = "/";
    render(<PublicShell><p>Home</p></PublicShell>);
    expect(within(screen.getByRole("contentinfo")).getByText(/Metro Manila/)).toBeInTheDocument();
  });
});
