// Step 1.22: fails when a component holds a raw color, size or radius.
// Raw values live only in src/styles/tokens.css. Components use var(--token).
// Run: npm run check:tokens

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Folders that hold components and screens.
export const SCAN_DIRS = ["src/components", "src/app"];
// Files that are not scanned. Empty on purpose: globals.css is scanned too. See decision-log.md #11.
export const SKIP_FILES = [];
// Media queries cannot read custom properties, so these widths are allowed. See decision-log.md #10 and #11.
export const ALLOWED_BREAKPOINTS = ["40rem", "48rem"];

const LENGTH_UNITS =
  "px|rem|em|ex|ch|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|pt|pc|cm|mm|in|cqw|cqh";
const LENGTH = new RegExp(`(?<![\\w.#-])-?(?:\\d*\\.)?\\d+(?:${LENGTH_UNITS})\\b`, "gi");
const HEX = /#[0-9a-f]{3,8}\b/i;
const COLOR_FN = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;

const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet " +
    "brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan " +
    "darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen " +
    "darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey " +
    "darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite " +
    "forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue " +
    "lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon " +
    "lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen " +
    "linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen " +
    "mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose " +
    "moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red " +
    "rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue " +
    "slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white " +
    "whitesmoke yellow yellowgreen"
  ).split(" "),
);

const COLOR_PROPS =
  /^(?:color|background|background-color|border(?:-[a-z-]+)?|outline(?:-[a-z-]+)?|fill|stroke|box-shadow|text-shadow|accent-color|caret-color|text-decoration(?:-color)?|column-rule(?:-color)?)$/;
const RADIUS_PROPS = /^border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius$/;
const RADIUS_OK = new Set([
  "var(--radius-control)",
  "var(--radius-surface)",
  "0",
  "inherit",
  "initial",
  "unset",
]);

// Replace comments with spaces. Line numbers stay the same.
function blank(text, kind) {
  let out = "";
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\" && kind !== "css") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, " ");
      i = stop;
      continue;
    }
    if (kind === "code" && ch === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const stop = end === -1 ? text.length : end;
      out += " ".repeat(stop - i);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || (kind === "code" && ch === "`")) quote = ch;
    out += ch;
    i += 1;
  }
  return out;
}

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text[i] === "\n") line += 1;
  return line;
}

// Checks one declaration value. Returns a list of problems.
export function checkValue(prop, rawValue) {
  const problems = [];
  const value = rawValue
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""') // strings are text, not styles
    .replace(/url\([^)]*\)/gi, "url()")
    .replace(/var\(\s*--[\w-]+/g, "var(") // keep any fallback value, drop the token name
    .trim();

  if (RADIUS_PROPS.test(prop)) {
    const parts = rawValue.trim().split(/\s*\/\s*|\s+/).filter(Boolean);
    if (parts.some((p) => !RADIUS_OK.has(p))) {
      problems.push(`raw radius "${rawValue.trim()}": use var(--radius-control) or var(--radius-surface)`);
    }
    return problems;
  }

  if (HEX.test(value) || COLOR_FN.test(value)) {
    problems.push(`raw color in "${prop}: ${rawValue.trim()}": use a --color token`);
  } else if (COLOR_PROPS.test(prop)) {
    const words = value.toLowerCase().match(/[a-z]+/g) ?? [];
    const named = words.find((w) => NAMED_COLORS.has(w));
    if (named) problems.push(`raw color "${named}" in "${prop}": use a --color token`);
  }

  const lengths = value.match(LENGTH)?.filter((l) => !/^-?0*\.?0+[a-z]+$/i.test(l)) ?? [];
  for (const l of lengths) problems.push(`raw size "${l}" in "${prop}": use a token`);

  if (prop === "font-size" && /%/.test(value)) problems.push(`raw size in "font-size: ${rawValue.trim()}": use a --font-size token`);
  return problems;
}

export function checkCss(text) {
  const css = blank(text, "css");
  const found = [];

  // Media and container queries: only the allowed widths.
  const preludes = /@(?:media|container|supports)\b([^{;]*)\{/gi;
  let cleaned = css;
  for (const m of css.matchAll(preludes)) {
    for (const l of m[1].match(LENGTH) ?? []) {
      if (!ALLOWED_BREAKPOINTS.includes(l.toLowerCase())) {
        found.push({ line: lineOf(css, m.index), message: `raw size "${l}" in a media query: allowed widths are ${ALLOWED_BREAKPOINTS.join(" and ")}` });
      }
    }
    cleaned = cleaned.replace(m[0], m[0].replace(/[^\n]/g, " "));
  }

  const decl = /([\w-]+)\s*:\s*([^;{}]+)(?=;|\})/g;
  for (const m of cleaned.matchAll(decl)) {
    for (const message of checkValue(m[1].toLowerCase(), m[2])) {
      found.push({ line: lineOf(cleaned, m.index), message });
    }
  }
  return found;
}

const SIZE_KEYS =
  /^(?:width|height|minWidth|maxWidth|minHeight|maxHeight|padding\w*|margin\w*|gap|rowGap|columnGap|top|right|bottom|left|inset|fontSize|borderRadius|borderWidth|blockSize|inlineSize)$/;

export function checkTsx(text) {
  const code = blank(text, "code");
  const found = [];
  const add = (index, message) => found.push({ line: lineOf(code, index), message });

  // Hex color or color function inside a string.
  for (const m of code.matchAll(/["'`]\s*#[0-9a-f]{3,8}\s*["'`]/gi)) add(m.index, `raw color ${m[0].trim()}: use a --color token`);
  for (const m of code.matchAll(/["'`][^"'`\n]*\b(?:rgb|rgba|hsl|hsla|hwb|oklch|oklab)\([^"'`\n]*["'`]/gi)) add(m.index, "raw color function: use a --color token");

  // Icon and element attributes.
  for (const m of code.matchAll(/\b(?:color|fill|stroke)=(?:"([^"]*)"|\{\s*["'`]([^"'`]*)["'`]\s*\})/g)) {
    const v = (m[1] ?? m[2]).trim();
    if (!/^(?:currentColor|none|inherit|transparent|var\(--[\w-]+\))$/i.test(v)) add(m.index, `raw color in attribute "${m[0]}": use currentColor or a --color token`);
  }
  for (const m of code.matchAll(/\b(?:size|width|height|strokeWidth)=(?:\{\s*-?\d[\d.]*\s*\}|"-?\d[\d.]*(?:px|rem|em)?")/g)) add(m.index, `raw size in attribute "${m[0]}": size it in a CSS module with a token`);

  // Inline style objects.
  for (const m of code.matchAll(/style=\{\{/g)) {
    let depth = 0;
    let end = m.index + m[0].length - 2;
    for (let i = end; i < code.length; i += 1) {
      if (code[i] === "{") depth += 1;
      if (code[i] === "}") depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    const block = code.slice(m.index, end + 1);
    for (const e of block.matchAll(/([A-Za-z]+)\s*:\s*(-?\d[\d.]*)\s*(?=[,}])/g)) {
      if (SIZE_KEYS.test(e[1]) && Number(e[2]) !== 0) add(m.index, `raw size "${e[1]}: ${e[2]}" in an inline style: use a token`);
    }
    for (const e of block.matchAll(/([A-Za-z]+)\s*:\s*["'`]([^"'`]*)["'`]/g)) {
      const prop = e[1].replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      for (const message of checkValue(prop, e[2])) add(m.index, `${message} (inline style)`);
    }
  }
  return found;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(?:css|tsx|ts)$/.test(entry.name)) out.push(path);
  }
  return out;
}

export function checkProject(root = process.cwd()) {
  const results = [];
  for (const dir of SCAN_DIRS) {
    for (const path of walk(join(root, dir))) {
      const rel = relative(root, path).split(sep).join("/");
      if (SKIP_FILES.includes(rel)) continue;
      const text = readFileSync(path, "utf8");
      const found = rel.endsWith(".css") ? checkCss(text) : checkTsx(text);
      for (const f of found) results.push({ file: rel, ...f });
    }
  }
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const results = checkProject();
  if (results.length === 0) {
    console.log("Token check passed: no raw colors, sizes or radii in components.");
  } else {
    for (const r of results) console.error(`${r.file}:${r.line}  ${r.message}`);
    console.error(`\nToken check failed: ${results.length} problem${results.length === 1 ? "" : "s"}. Move raw values into src/styles/tokens.css and use var(--token).`);
    process.exitCode = 1;
  }
}
