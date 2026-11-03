/** Public Supabase project URL and publishable / legacy anon key.
 * Both values are intended for browser use; never put the service-role key here.
 */
export type SupabaseEnvStatus =
  "ready" | "setup_required" | "invalid_configuration";

function readPublicEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  };
}

export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const { url, anonKey } = readPublicEnv();
  if (!url || !anonKey) return "setup_required";
  // Values from a copied setup guide are not real credentials.
  if (
    /^(?:YOUR[_ -]|PASTE[_ -]|REPLACE[_ -]|<)/i.test(url) ||
    /^(?:YOUR[_ -]|PASTE[_ -]|REPLACE[_ -]|<)/i.test(anonKey)
  ) {
    return "invalid_configuration";
  }
  try {
    const parsed = new URL(url);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    if (
      (parsed.protocol !== "https:" &&
        !(isLocal && parsed.protocol === "http:")) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      (parsed.pathname !== "/" && parsed.pathname !== "") ||
      parsed.search ||
      parsed.hash
    ) {
      return "invalid_configuration";
    }
  } catch {
    return "invalid_configuration";
  }
  return "ready";
}

export function getSupabasePublicEnv(): {
  url: string;
  anonKey: string;
} | null {
  if (getSupabaseEnvStatus() !== "ready") return null;
  return readPublicEnv();
}

export const SETUP_MESSAGE =
  "Supabase is not configured correctly. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev. Run npm run auth:check to diagnose setup.";

export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error(SETUP_MESSAGE);
  return env;
}
