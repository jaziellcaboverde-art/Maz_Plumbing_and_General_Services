export function safeAppLink(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Notification links must be paths inside this app.");
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return new URL(path, siteUrl).toString();
}
