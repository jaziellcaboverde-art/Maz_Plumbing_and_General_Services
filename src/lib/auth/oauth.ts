/** Short-lived cookie that carries "where to go after Google" from the button to /auth/confirm. */
export const OAUTH_NEXT_COOKIE = "maz_oauth_next";

/** Only paths on this site. Blocks //evil.com, backslash tricks and full URLs. */
export function safeNextPath(value: string | null | undefined, fallback = "/"): string {
  if (value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  return fallback;
}
