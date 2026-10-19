/**
 * Public Supabase settings. Both values are safe for the browser.
 * The names are written out in full on purpose: Next.js only puts a NEXT_PUBLIC_ value into the
 * browser bundle when it sees the full name.
 */
export function getSupabasePublicEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const SETUP_MESSAGE =
  "Supabase is not set up yet. Fill NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then restart npm run dev.";

export function requireSupabasePublicEnv(): { url: string; anonKey: string } {
  const env = getSupabasePublicEnv();
  if (!env) throw new Error(SETUP_MESSAGE);
  return env;
}
