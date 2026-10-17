import { describe, expect, test } from "vitest";
import { checkCss, checkProject, checkTsx } from "../scripts/check-tokens.mjs";

const cssProblems = (css: string) => checkCss(css).map((p) => p.message);
const tsxProblems = (tsx: string) => checkTsx(tsx).map((p) => p.message);

describe("token check on the real project (step 1.22)", () => {
  test("no component or screen holds a raw color, size or radius", () => {
    expect(checkProject()).toEqual([]);
  });
});

describe("token check catches raw values in css", () => {
  test.each([
    [".a { color: #fff; }", "raw color"],
    [".a { background: #1b2b5bcc; }", "raw color"],
    [".a { box-shadow: 0 0 var(--space-1) rgb(0 0 0 / 0.2); }", "raw color"],
    [".a { border: var(--border-width) solid red; }", "raw color"],
    [".a { padding: 12px; }", "raw size"],
    [".a { margin: -4px; }", "raw size"],
    [".a { gap: .75rem; }", "raw size"],
    [".a { padding: var(--space-1, 10px); }", "raw size"],
    [".a { font-size: 90%; }", "raw size"],
    [".a { --local: #abc; }", "raw color"],
    [".a { border-radius: 6px; }", "raw radius"],
    [".a { border-radius: 50%; }", "raw radius"],
    [".a { border-top-left-radius: 4px; }", "raw radius"],
    ["@media (min-width: 768px) { .a { color: var(--color-ink); } }", "media query"],
    ["@media (min-width: 50rem) { .a { color: var(--color-ink); } }", "media query"],
  ])("%s", (css, expected) => {
    expect(cssProblems(css).join(" ")).toContain(expected);
  });
});

describe("token check allows token use and the allowed exceptions", () => {
  test.each([
    ".a { color: var(--color-ink); background: var(--color-paper); }",
    ".a { border: var(--border-width) solid var(--color-gray-line); }",
    ".a { margin: 0; padding: 0px; }",
    ".a { border-radius: var(--radius-control); }",
    ".a { border-radius: var(--radius-surface) var(--radius-surface) 0 0; }",
    ".a { inline-size: 100%; }",
    "@media (min-width: 40rem) { .a { color: var(--color-ink); } }",
    "@media (min-width: 48rem) { .a { color: var(--color-ink); } }",
    "@keyframes spin { to { transform: rotate(360deg); } }",
    "/* #fff 12px red */ .a { color: var(--color-ink); }",
    '.a::after { content: "12px red"; }',
    "a:hover, .b:focus-visible { color: var(--color-navy); }",
  ])("%s", (css) => {
    expect(cssProblems(css)).toEqual([]);
  });

  test("reports the line of the problem", () => {
    const found = checkCss(".a {\n  color: var(--color-ink);\n  padding: 12px;\n}");
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(3);
  });
});

describe("token check on tsx", () => {
  test.each([
    ['const c = "#fff";', "raw color"],
    ['<X color="red" />', "raw color"],
    ["<X size={20} />", "raw size"],
    ['<div style={{ padding: 12 }} />', "raw size"],
    ['<div style={{ color: "#333" }} />', "raw color"],
    ['<div style={{ margin: "8px" }} />', "raw size"],
  ])("%s", (tsx, expected) => {
    expect(tsxProblems(tsx).join(" ")).toContain(expected);
  });

  test.each([
    '<a href="#main">Skip</a>',
    '<X color="currentColor" />',
    '<AppShell role="admin" width="full" />',
    '<div style={{ color: "var(--color-ink)", padding: 0 }} />',
    '<div style={{ "--n": 3 }} />',
    'const u = "https://example.test"; // #fff 12px',
  ])("%s", (tsx) => {
    expect(tsxProblems(tsx)).toEqual([]);
  });
});
