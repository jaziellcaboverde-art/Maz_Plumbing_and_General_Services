import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/layout/app-shell";
import { PublicShell } from "@/components/layout/public-shell";
import { NAV, ROLES } from "@/components/layout/nav-config";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

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
const codeFiles = sourceFiles.filter((f) => /\.(?:tsx|ts)$/.test(f));

// Removes comments so a word in a comment cannot fail or pass a check.
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Header is identical on every page (step 1.23)
// ---------------------------------------------------------------------------
describe("header is identical on every page", () => {
  test("only the two shells render a header element", () => {
    const withHeader = codeFiles.filter((f) => /<header[\s>]/.test(read(f)));
    expect(withHeader.sort()).toEqual([
      "src/components/layout/app-shell.tsx",
      "src/components/layout/public-shell.tsx",
    ]);
  });

  test("both shells take the header style from the same file", () => {
    for (const file of ["app-shell", "public-shell"]) {
      const source = read(`src/components/layout/${file}.tsx`);
      expect(source).toContain('from "./shell.module.css"');
      expect(source).toContain("<header className={styles.header}>");
    }
  });

  test("header height comes from one token and no media query changes it", () => {
    const shell = withoutComments(read("src/components/layout/shell.module.css"));
    const header = shell.match(/\n\.header\s*\{([^}]*)\}/);
    expect(header).not.toBeNull();
    expect(header![1]).toMatch(/block-size:\s*var\(--header-height\)/);

    for (const file of cssFiles.filter((f) => f.startsWith("src/components/layout/"))) {
      const css = withoutComments(read(file));
      const media = [...css.matchAll(/@media[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
      expect(media, `${file} must not restyle the header inside a media query`).not.toMatch(/\.header\b/);
    }
  });

  test("the header height token is defined once", () => {
    const definitions = cssFiles.filter((f) => /--header-height\s*:/.test(read(f)));
    expect(definitions).toEqual(["src/styles/tokens.css"]);
  });

  type ShellCase = [name: string, home: string, view: () => React.ReactElement];
  const shells: ShellCase[] = [
    ["public", "/", () => <PublicShell><p>Page</p></PublicShell>],
    ...ROLES.map(
      (role): ShellCase => [role, NAV[role].home, () => <AppShell role={role}><p>Page</p></AppShell>],
    ),
  ];

  test.each(shells)("%s shell: logo first, one control last", (_name, home, view) => {
    pathname.value = home;
    render(view());
    const header = screen.getByRole("banner");
    const first = header.firstElementChild as HTMLElement;
    const last = header.lastElementChild as HTMLElement;
    expect(first).toHaveTextContent("Capstone");
    expect(first.tagName).toBe("A");
    expect(last.tagName).toBe("A");
    expect(last).not.toBe(first);
  });

  test("all four shells give the header the same class", () => {
    const classes = shells.map(([, home, view]) => {
      pathname.value = home;
      const { unmount } = render(view());
      const name = screen.getByRole("banner").className;
      unmount();
      return name;
    });
    expect(classes[0]).not.toBe("");
    expect(new Set(classes).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Keyboard focus is visible (step 1.23)
// ---------------------------------------------------------------------------
describe("keyboard focus is visible", () => {
  test("one global focus ring uses the focus tokens and navy", () => {
    const globals = withoutComments(read("src/app/globals.css"));
    const rule = globals.match(/:focus-visible\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule![1]).toMatch(/outline:\s*var\(--focus-ring-width\)\s+solid\s+var\(--color-navy\)/);
    expect(rule![1]).toMatch(/outline-offset:\s*var\(--focus-ring-offset\)/);
  });

  test("no stylesheet removes an outline", () => {
    for (const file of cssFiles) {
      const css = withoutComments(read(file));
      expect(css, `${file} removes an outline`).not.toMatch(/outline(?:-style|-width)?\s*:\s*(?:none|0)\s*[;}]/);
    }
  });

  test("tab reaches the skip link first, then the logo, in every shell", async () => {
    const user = userEvent.setup();
    for (const role of ROLES) {
      pathname.value = NAV[role].home;
      const { unmount } = render(<AppShell role={role}><p>Page</p></AppShell>);
      await user.tab();
      expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("link", { name: "Capstone" })).toHaveFocus();
      unmount();
    }
    pathname.value = "/";
    render(<PublicShell><p>Page</p></PublicShell>);
    await user.tab();
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Capstone" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveFocus();
  });

  test("nothing in the shells is taken out of the tab order", () => {
    for (const file of codeFiles.filter((f) => f.startsWith("src/components/layout/"))) {
      expect(read(file), `${file} uses tabIndex -1`).not.toMatch(/tabIndex=\{?-1\}?/);
    }
  });
});

// ---------------------------------------------------------------------------
// Reduced motion is respected (step 1.23)
// ---------------------------------------------------------------------------
describe("reduced motion is respected", () => {
  const globals = withoutComments(read("src/app/globals.css"));
  const block = globals.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/);

  test("globals.css switches animation, transition and smooth scrolling off for every element", () => {
    expect(block).not.toBeNull();
    const body = block![1];
    expect(body).toMatch(/\*/);
    expect(body).toMatch(/animation-duration:\s*var\(--duration-reduced-motion\)\s*!important/);
    expect(body).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(body).toMatch(/transition-duration:\s*var\(--duration-reduced-motion\)\s*!important/);
    expect(body).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  test("nothing asks for smooth scrolling in css or code", () => {
    for (const file of [...cssFiles, ...codeFiles]) {
      expect(withoutComments(read(file)), `${file} asks for smooth scrolling`).not.toMatch(
        /scroll-behavior:\s*smooth|behavior:\s*["']smooth["']/,
      );
    }
  });

  test("no entrance animations: the only keyframes are the loading spinner", () => {
    const names = cssFiles.flatMap((f) =>
      [...withoutComments(read(f)).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
    );
    expect(names).toEqual(["spin"]);
  });
});
