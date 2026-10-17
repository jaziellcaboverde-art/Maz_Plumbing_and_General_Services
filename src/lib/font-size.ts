/**
 * Font size engine (step 1.19). Four user levels, stored in a cookie for now.
 * Phase 5 saves the level to user_settings as well. The level is applied as
 * data-font-size on the root element, and src/styles/font-size.css does the rest.
 */
export const FONT_SIZE_LEVELS = ["small", "medium", "large", "extra-large"] as const;

export type FontSizeLevel = (typeof FONT_SIZE_LEVELS)[number];

export const DEFAULT_FONT_SIZE: FontSizeLevel = "medium";

export const FONT_SIZE_COOKIE = "capstone-font-size";

export const FONT_SIZE_LABELS: Record<FontSizeLevel, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
  "extra-large": "Extra large",
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function isFontSizeLevel(value: unknown): value is FontSizeLevel {
  return (
    typeof value === "string" &&
    (FONT_SIZE_LEVELS as readonly string[]).includes(value)
  );
}

/** Any unknown or missing value falls back to the default level. */
export function parseFontSize(value: string | null | undefined): FontSizeLevel {
  return isFontSizeLevel(value) ? value : DEFAULT_FONT_SIZE;
}

/** Sets the level on the root element and remembers it in a cookie. */
export function applyFontSize(level: FontSizeLevel, doc: Document = document): void {
  doc.documentElement.setAttribute("data-font-size", level);
  doc.cookie = `${FONT_SIZE_COOKIE}=${level}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/**
 * Inline script for <head>. Runs while the HTML is parsed, so the saved level
 * is applied before the first paint and there is no flash. Unknown values are ignored.
 */
export function fontSizeInitScript(): string {
  const levels = JSON.stringify(FONT_SIZE_LEVELS);
  return `(function(){try{var m=document.cookie.match(/(?:^|; )${FONT_SIZE_COOKIE}=([^;]*)/);var v=m&&decodeURIComponent(m[1]);if(v&&${levels}.indexOf(v)>-1)document.documentElement.setAttribute("data-font-size",v)}catch(e){}})()`;
}
