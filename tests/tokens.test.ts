import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!m) throw new Error(`Missing token --${name}`);
  return m[1].trim();
}

function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const c = (name: string) => token(`color-${name}`);

describe("contrast (step 1.17)", () => {
  const textOnPaper = ["ink", "gray-text", "navy", "success", "warning", "error"];
  test.each(textOnPaper)("%s text on paper is at least 4.5 to 1", (name) => {
    expect(contrast(c(name), c("paper"))).toBeGreaterThanOrEqual(4.5);
  });

  test("white text on navy and navy deep buttons is at least 4.5 to 1", () => {
    expect(contrast(c("paper"), c("navy"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(c("paper"), c("navy-deep"))).toBeGreaterThanOrEqual(4.5);
  });

  test("input borders and icons (gray line) are at least 3 to 1 on paper", () => {
    expect(contrast(c("gray-line"), c("paper"))).toBeGreaterThanOrEqual(3);
  });

  test("focus ring (navy) is at least 3 to 1 on paper", () => {
    expect(contrast(c("navy"), c("paper"))).toBeGreaterThanOrEqual(3);
  });
});

describe("locked token values (step 1.16)", () => {
  test("radius is 8 and 16 only", () => {
    expect(token("radius-control")).toBe("0.5rem");
    expect(token("radius-surface")).toBe("1rem");
    expect(css.match(/--radius-[a-z-]+:/g)).toHaveLength(2);
  });

  test("font weights are 400 and 600 only", () => {
    expect(token("font-weight-regular")).toBe("400");
    expect(token("font-weight-strong")).toBe("600");
    expect(css.match(/--font-weight-[a-z-]+:/g)).toHaveLength(2);
  });

  test("there are exactly 3 font size tokens", () => {
    expect(css.match(/--font-size-[a-z-]+:/g)).toHaveLength(3);
  });

  test("tap target is at least 2.75rem", () => {
    expect(parseFloat(token("tap-target"))).toBeGreaterThanOrEqual(2.75);
  });
});
