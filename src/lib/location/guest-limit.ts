/**
 * Address search and pin lookup are open to visitors who have no account yet, so they can pick a base
 * location while applying as a provider. Each lookup spends the map service quota, so visitors get a
 * small allowance per minute. The count lives in memory on one server instance, which is a best-effort
 * guard against runaway use, not a hard limit.
 */
const WINDOW_MS = 60_000;
const MAX_LOOKUPS = 30;
const hits = new Map<string, number[]>();

export function allowGuestLookup(visitor: string | null, now = Date.now()): boolean {
  const key = visitor ?? "unknown";
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_LOOKUPS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Drop idle visitors so the map cannot grow without end.
  if (hits.size > 5000) {
    for (const [other, times] of hits) if (times.every((time) => now - time >= WINDOW_MS)) hits.delete(other);
  }
  return true;
}
