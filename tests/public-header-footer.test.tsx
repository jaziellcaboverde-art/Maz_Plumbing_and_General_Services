import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthSplit } from "@/components/auth/auth-split";
import { PublicShell } from "@/components/layout/public-shell";

afterEach(cleanup);

function expectSharedHeaderAndFooter() {
  const header = screen.getByRole("banner");
  const footer = screen.getByRole("contentinfo");
  expect(within(header).getByRole("link", { name: /MAZ Plumbing and General Services/ })).toHaveAttribute("href", "/");
  expect(within(header).getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  expect(within(header).getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
  expect(within(footer).getByText("Visit us")).toBeInTheDocument();
  expect(within(footer).getByRole("link", { name: "Apply to become a provider" })).toHaveAttribute("href", "/apply/provider");
}

describe("persistent public header and footer", () => {
  test.each(["login", "signup"]) ("%s page keeps home navigation and footer", (route) => {
    render(<PublicShell><AuthSplit><h1>{route}</h1></AuthSplit></PublicShell>);
    expect(screen.getByRole("heading", { name: route })).toBeInTheDocument();
    expectSharedHeaderAndFooter();
  });

  test("provider application and submitted state keep the public chrome", () => {
    render(<PublicShell><div data-public-fullbleed="true"><h1>Apply as a provider</h1></div></PublicShell>);
    expect(screen.getByRole("heading", { name: "Apply as a provider" })).toBeInTheDocument();
    expectSharedHeaderAndFooter();
  });

  test("public CSS never hides the header or footer on full-bleed routes", () => {
    const css = readFileSync(join(process.cwd(), "src/components/layout/public-shell.module.css"), "utf8");
    expect(css).toContain('.main:has([data-public-fullbleed="true"])');
    expect(css).not.toMatch(/\.shell:has\(\[data-login-screen/);
    expect(css).not.toMatch(/\.header\s*,\s*\n[^}]*\.footer\s*\{\s*display:\s*none/);
  });
});
