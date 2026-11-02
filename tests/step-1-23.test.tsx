
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import Link from "next/link";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

// Prevent Next.js request-scope errors when testing the async AppShell.
vi.mock("next/server", () => ({
  connection: async () => {},
}));

// A signed-out stub is enough for these layout tests.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrl: async () => ({ data: null }),
      }),
    },
  }),
}));

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => (
    <Link href="/notifications" aria-label="Notifications" />
  ),
}));

import { AppShell } from "@/components/layout/app-shell";
import { PublicShell } from "@/components/layout/public-shell";
import { NAV, ROLES } from "@/components/layout/nav-config";

afterEach(cleanup);

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const sourceFiles = walk("src");
const cssFiles = sourceFiles.filter((f) => f.endsWith(".css"));
const codeFiles = sourceFiles.filter((f) => /\.tsx?$/.test(f));

// Remove comments so words inside comments cannot affect a check.
const withoutComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Header is identical on every page (step 1.23)
// ---------------------------------------------------------------------------
describe("header is identical on every page", () => {
  test("no page or layout draws its own site header; only the two shells do", () => {
    const withHeader = codeFiles.filter((f) => /<header[\s>]/.test(read(f)));

    expect(withHeader).toContain("src/components/layout/app-shell.tsx");
    expect(withHeader).toContain("src/components/layout/public-shell.tsx");

    // Components may use <header> for a card or section title inside main.
    // A page.tsx or layout.tsx must never render one: the shell owns the banner.
    const owners = withHeader.filter((f) => /\/(?:page|layout)\.tsx$/.test(f));

    expect(owners).toEqual([]);
  });

  test("the role shell takes the header style from shell.module.css and the guest shell from its own file", () => {
    const app = read("src/components/layout/app-shell.tsx");

    expect(app).toContain('from "./shell.module.css"');
    expect(app).toContain("<header className={styles.header}>");

    const guest = read("src/components/layout/public-shell.tsx");

    expect(guest).toContain('from "./public-shell.module.css"');
    expect(guest).toContain("<header className={styles.header}>");
  });

  test("header height comes from one token and no media query changes it", () => {
    const shell = withoutComments(
      read("src/components/layout/shell.module.css"),
    );
    const header = shell.match(/\.header\s*\{([^}]*)\}/);

    expect(header).not.toBeNull();
    expect(header![1]).toMatch(
      /block-size:\s*var\(--header-height\)/,
    );

    // The role shell may reposition its header in a media query, but must not resize it.
    for (const file of [
      "src/components/layout/shell.module.css",
      "src/components/layout/public-shell.module.css",
    ]) {
      const css = withoutComments(read(file));
      const media = [
        ...css.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g),
      ]
        .map((m) => m[1])
        .join("\n");

      const headerRules = [
        ...media.matchAll(/([^{}]*\.header\b[^{}]*)\{([^}]*)\}/g),
      ].map((m) => m[2]);

      for (const body of headerRules) {
        expect(
          body,
          `${file} must not change the header height inside a media query`,
        ).not.toMatch(
          /(?:block-size|min-block-size|max-block-size|height)\s*:/,
        );
      }
    }
  });

  test("the header height token is defined once", () => {
    const definitions = cssFiles.filter((f) =>
      /--header-height\s*:/.test(read(f)),
    );

    expect(definitions).toEqual(["src/styles/tokens.css"]);
  });

  type ShellCase = [
    name: string,
    home: string,
    view: () => Promise<React.ReactElement>,
  ];

  const shells: ShellCase[] = [
    ["public", "/", async () => (
      <PublicShell>
        <p>Page</p>
      </PublicShell>
    )],
    ...ROLES.map(
      (role): ShellCase => [
        role,
        NAV[role].home,
        () => AppShell({ role, children: <p>Page</p> }),
      ],
    ),
  ];

  test.each(shells)(
    "%s shell: logo first, one control group last",
    async (_name, home, view) => {
      pathname.value = home;
      render(await view());

      const header = screen.getByRole("banner");
      const first = header.firstElementChild as HTMLElement;
      const last = header.lastElementChild as HTMLElement;

      expect(first).toHaveTextContent("MAZ Plumbing and General Services");
      expect(first.tagName).toBe("A");

      // Guests have Log in and Sign up; role shells have the notification bell.
      expect(last.tagName).toBe("DIV");
      expect(last).not.toBe(first);
    },
  );

  test("the three role shells give the header the same class", async () => {
    const classes: string[] = [];

    for (const [name, home, view] of shells) {
      if (name === "public") continue;

      pathname.value = home;
      const { unmount } = render(await view());

      classes.push(screen.getByRole("banner").className);
      unmount();
    }

    expect(classes[0]).not.toBe("");
    expect(new Set(classes).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Keyboard focus is visible (step 1.23)
// ---------------------------------------------------------------------------
describe("keyboard focus is visible", () => {
  test("one global focus ring uses the focus tokens and the accent colour", () => {
    const globals = withoutComments(read("src/app/globals.css"));
    const rule = globals.match(/:focus-visible\s*\{([^}]*)\}/);

    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(
      /outline:\s*var\(--focus-ring-width\)\s+solid\s+var\(--color-accent\)/,
    );
    expect(rule![1]).toMatch(
      /outline-offset:\s*var\(--focus-ring-offset\)/,
    );
  });

  test("no stylesheet removes an outline", () => {
    for (const file of cssFiles) {
      const css = withoutComments(read(file));

      expect(css, `${file} removes an outline`).not.toMatch(
        /outline(?:-style|-width)?\s*:\s*(?:none|0)\s*[;}]/,
      );
    }
  });

  test("tab reaches the skip link first, then the logo, in every shell", async () => {
    const user = userEvent.setup();

    for (const role of ROLES) {
      pathname.value = NAV[role].home;

      const { unmount } = render(
        await AppShell({ role, children: <p>Page</p> }),
      );

      await user.tab();

      expect(
        screen.getByRole("link", { name: "Skip to content" }),
      ).toHaveFocus();

      await user.tab();

      expect(
        screen.getByRole("link", {
          name: "MAZ Plumbing and General Services",
        }),
      ).toHaveFocus();

      unmount();
    }

    pathname.value = "/";

    render(
      <PublicShell>
        <p>Page</p>
      </PublicShell>,
    );

    await user.tab();

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveFocus();

    await user.tab();

    expect(
      screen.getByRole("link", {
        name: "MAZ Plumbing and General Services",
      }),
    ).toHaveFocus();

    // The guest header has navigation links between the logo and the buttons.
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    // The footer also has a Log in link, so look inside the header only.
    expect(
      within(screen.getByRole("banner")).getByRole("link", {
        name: "Log in",
      }),
    ).toHaveFocus();
  });

  test("nothing in the shells is taken out of the tab order", () => {
    for (const file of codeFiles.filter((f) =>
      f.startsWith("src/components/layout/"),
    )) {
      expect(read(file), `${file} uses tabIndex -1`).not.toMatch(
        /tabIndex=\{?-1\}?/,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Reduced motion is respected (step 1.23)
// ---------------------------------------------------------------------------
describe("reduced motion is respected", () => {
  const globals = withoutComments(read("src/app/globals.css"));

  const block = globals.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/,
  );

  test("globals.css switches animation, transition and smooth scrolling off for every element", () => {
    expect(block).not.toBeNull();

    const body = block![1];


    expect(body).toMatch(
      /animation-duration:\s*var\(--duration-reduced-motion\)\s*!important/,
    );
    expect(body).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(body).toMatch(
      /transition-duration:\s*var\(--duration-reduced-motion\)\s*!important/,
    );
    expect(body).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  test("nothing asks for smooth scrolling in css or code", () => {
    for (const file of [...cssFiles, ...codeFiles]) {
      expect(
        withoutComments(read(file)),
        `${file} asks for smooth scrolling`,
      ).not.toMatch(
        /scroll-behavior:\s*smooth|behavior:\s*["']smooth["']/,
      );
    }
  });

  test("no entrance animations: the only keyframes are the loading spinner", () => {
    const names = cssFiles.flatMap((f) =>
      [...withoutComments(read(f)).matchAll(/@keyframes\s+([\w-]+)/g)].map(
        (m) => m[1],
      ),
    );

    expect(names).toEqual(["spin"]);
  });
});
