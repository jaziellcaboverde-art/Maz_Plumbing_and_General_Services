import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_FONT_SIZE,
  FONT_SIZE_COOKIE,
  FONT_SIZE_LEVELS,
  applyFontSize,
  fontSizeInitScript,
  isFontSizeLevel,
  parseFontSize,
} from "@/lib/font-size";

const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").replace(/\r\n/g, "\n");
const tokens = read("src/styles/tokens.css");
const engine = read("src/styles/font-size.css");

describe("font size levels (step 1.19)", () => {
  test("there are exactly 4 levels and the default is medium", () => {
    expect(FONT_SIZE_LEVELS).toEqual(["small", "medium", "large", "extra-large"]);
    expect(DEFAULT_FONT_SIZE).toBe("medium");
  });

  test("parseFontSize falls back to medium for unknown or missing values", () => {
    expect(parseFontSize("large")).toBe("large");
    expect(parseFontSize("huge")).toBe("medium");
    expect(parseFontSize("")).toBe("medium");
    expect(parseFontSize(null)).toBe("medium");
    expect(parseFontSize(undefined)).toBe("medium");
    expect(isFontSizeLevel(42)).toBe(false);
  });
});

describe("root sizes", () => {
  const expected: Record<string, string> = {
    small: "87.5%",
    medium: "100%",
    large: "112.5%",
    "extra-large": "125%",
  };

  test.each(FONT_SIZE_LEVELS)("%s has the right token and CSS rule", (level) => {
    expect(tokens).toContain(`--root-size-${level}: ${expected[level]};`);
    expect(engine).toContain(
      `html[data-font-size="${level}"] {\n  font-size: var(--root-size-${level});`,
    );
  });

  test("every font size token is in rem, so nothing is fixed in px", () => {
    const sizes = tokens.match(/--font-size-[a-z-]+:\s*[^;]+;/g) ?? [];
    // Five tokens, pinned in tokens.test.ts. See the note there about the 3 size guideline.
    expect(sizes).toHaveLength(5);
    for (const line of sizes) expect(line).toMatch(/rem;$/);
  });

  test("the engine file uses tokens only, no raw sizes", () => {
    const declarations = engine.match(/font-size:[^;]+;/g) ?? [];
    for (const d of declarations) expect(d).toMatch(/var\(--root-size-/);
  });
});

describe("applyFontSize", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-font-size");
    document.cookie = `${FONT_SIZE_COOKIE}=; max-age=0; path=/`;
  });

  test.each(FONT_SIZE_LEVELS)("%s is set on the root element and saved", (level) => {
    applyFontSize(level);
    expect(document.documentElement.getAttribute("data-font-size")).toBe(level);
    expect(document.cookie).toContain(`${FONT_SIZE_COOKIE}=${level}`);
  });
});

describe("init script (no flash before paint)", () => {
  function run(cookie: string) {
    const attrs: Record<string, string> = {};
    const fakeDocument = {
      cookie,
      documentElement: {
        setAttribute: (name: string, value: string) => {
          attrs[name] = value;
        },
      },
    };
    new Function("document", fontSizeInitScript())(fakeDocument);
    return attrs;
  }

  test.each(FONT_SIZE_LEVELS)("applies a saved %s level", (level) => {
    expect(run(`a=1; ${FONT_SIZE_COOKIE}=${level}; b=2`)).toEqual({
      "data-font-size": level,
    });
  });

  test("ignores unknown values and missing cookies", () => {
    expect(run(`${FONT_SIZE_COOKIE}=giant`)).toEqual({});
    expect(run("other=1")).toEqual({});
    expect(run("")).toEqual({});
  });
});
