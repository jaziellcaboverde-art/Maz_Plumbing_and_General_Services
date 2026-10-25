/**
 * Provider ranking (Phase 7, decision-log #30). Pure code so it can be tested without a database.
 * The weights and limits come from the config table, so the owner can tune them without a release.
 */

export type Weights = { distance: number; rating: number; reliability: number; past_jobs: number };
export type ReliabilityWeights = { accept_rate: number; on_time: number; no_cancel: number; no_show: number };

export type RankingConfig = {
  normal: Weights;
  urgent: Weights;
  maxDistanceKm: number;
  /** How many providers the customer sees on the pick screen. */
  listSize: number;
  reliability: ReliabilityWeights;
  newProvider: { minJobs: number; rating: number; reliability: number };
};

export const DEFAULT_RANKING_CONFIG: RankingConfig = {
  normal: { distance: 30, rating: 35, reliability: 20, past_jobs: 15 },
  urgent: { distance: 40, reliability: 25, rating: 25, past_jobs: 10 },
  maxDistanceKm: 15,
  listSize: 5,
  reliability: { accept_rate: 40, on_time: 30, no_cancel: 20, no_show: 10 },
  newProvider: { minJobs: 3, rating: 4.0, reliability: 70 },
};

/** Past jobs stop adding to the score after this many finished jobs. */
export const PAST_JOBS_CAP = 20;

/** One row from matching_candidates. Counts arrive as numbers or numeric strings. */
export type Candidate = {
  providerId: string;
  firstName: string;
  lastInitial: string;
  dailyRate: number | null;
  distanceM: number;
  reviewCount: number;
  avgStars: number | null;
  finishedJobs: number;
  offersTotal: number;
  offersAccepted: number;
  providerCancels: number;
  arrivalsTotal: number;
  arrivalsOnTime: number;
  /** The provider said "I can do this" for this job, so they may be listed even when far away. */
  interested: boolean;
};

export type ScoreParts = { distance: number; rating: number; reliability: number; pastJobs: number };

export type RankedCandidate = Candidate & {
  /** 0 to 100. */
  score: number;
  stars: number;
  /** 0 to 100. */
  reliabilityScore: number;
  isNew: boolean;
  /** Beyond the distance limit. Only listed because the provider said yes and few providers are near. */
  isFar: boolean;
  parts: ScoreParts;
};

function ratio(part: number, whole: number): number {
  return whole > 0 ? Math.min(Math.max(part / whole, 0), 1) : 1;
}

export function isNewProvider(c: Pick<Candidate, "finishedJobs">, cfg: RankingConfig): boolean {
  return c.finishedJobs < cfg.newProvider.minJobs;
}

/** Q27: accept rate 40%, on-time arrival 30%, no provider cancellations 20%, no no-shows 10%. */
export function reliabilityScore(c: Candidate, cfg: RankingConfig): number {
  if (isNewProvider(c, cfg)) return cfg.newProvider.reliability;
  const w = cfg.reliability;
  const total = w.accept_rate + w.on_time + w.no_cancel + w.no_show;
  if (total <= 0) return cfg.newProvider.reliability;
  const accept = ratio(c.offersAccepted, c.offersTotal);
  const onTime = ratio(c.arrivalsOnTime, c.arrivalsTotal);
  const jobsOrCancels = c.finishedJobs + c.providerCancels;
  const noCancel = jobsOrCancels > 0 ? 1 - Math.min(c.providerCancels / jobsOrCancels, 1) : 1;
  // No-shows are not recorded yet (Phase 10 adds them), so everyone has a clean record for now.
  const noShow = 1;
  return (100 * (w.accept_rate * accept + w.on_time * onTime + w.no_cancel * noCancel + w.no_show * noShow)) / total;
}

export function starsFor(c: Candidate, cfg: RankingConfig): number {
  if (isNewProvider(c, cfg) || c.avgStars === null || c.reviewCount === 0) return cfg.newProvider.rating;
  return Math.min(Math.max(c.avgStars, 1), 5);
}

export function scoreCandidate(c: Candidate, kind: "normal" | "urgent", cfg: RankingConfig): RankedCandidate {
  const w = kind === "urgent" ? cfg.urgent : cfg.normal;
  const maxM = cfg.maxDistanceKm * 1000;
  const stars = starsFor(c, cfg);
  const rel = reliabilityScore(c, cfg);
  const parts: ScoreParts = {
    distance: maxM > 0 ? Math.min(Math.max(1 - c.distanceM / maxM, 0), 1) : 0,
    rating: stars / 5,
    reliability: rel / 100,
    pastJobs: Math.min(c.finishedJobs, PAST_JOBS_CAP) / PAST_JOBS_CAP,
  };
  const total = w.distance + w.rating + w.reliability + w.past_jobs;
  const score = total > 0
    ? (w.distance * parts.distance + w.rating * parts.rating + w.reliability * parts.reliability + w.past_jobs * parts.pastJobs) * (100 / total)
    : 0;
  return { ...c, score: Math.round(score * 10) / 10, stars, reliabilityScore: Math.round(rel * 10) / 10, isNew: isNewProvider(c, cfg), isFar: c.distanceM > maxM, parts };
}

/**
 * Highest score first. Ties go to the closer provider, then to the id so the order is stable.
 * Providers within the distance limit come first. If fewer than the list size are near, providers
 * who said "I can do this" fill the list even when far away, so a customer in a quiet area still
 * gets someone who is willing.
 */
export function rankCandidates(candidates: readonly Candidate[], kind: "normal" | "urgent", cfg: RankingConfig): RankedCandidate[] {
  const order = (a: RankedCandidate, b: RankedCandidate) =>
    b.score - a.score || a.distanceM - b.distanceM || a.providerId.localeCompare(b.providerId);
  const maxM = cfg.maxDistanceKm * 1000;
  const near = candidates.filter((c) => c.distanceM <= maxM).map((c) => scoreCandidate(c, kind, cfg)).sort(order);
  if (near.length >= cfg.listSize) return near;
  const far = candidates.filter((c) => c.distanceM > maxM && c.interested).map((c) => scoreCandidate(c, kind, cfg)).sort(order);
  return [...near, ...far.slice(0, cfg.listSize - near.length)];
}

function num(value: unknown, fallback: number): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Turns the raw database row into a Candidate. */
export function candidateFromRow(row: Record<string, unknown>): Candidate {
  return {
    providerId: String(row.provider_id),
    firstName: String(row.first_name ?? ""),
    lastInitial: String(row.last_initial ?? ""),
    dailyRate: row.daily_rate === null || row.daily_rate === undefined ? null : num(row.daily_rate, 0),
    distanceM: num(row.distance_m, Number.POSITIVE_INFINITY),
    reviewCount: num(row.review_count, 0),
    avgStars: row.avg_stars === null || row.avg_stars === undefined ? null : num(row.avg_stars, 0),
    finishedJobs: num(row.finished_jobs, 0),
    offersTotal: num(row.offers_total, 0),
    offersAccepted: num(row.offers_accepted, 0),
    providerCancels: num(row.provider_cancels, 0),
    arrivalsTotal: num(row.arrivals_total, 0),
    arrivalsOnTime: num(row.arrivals_on_time, 0),
    interested: row.interested === true,
  };
}

function weightsFrom<T extends Record<string, number>>(value: unknown, fallback: T): T {
  if (!value || typeof value !== "object") return fallback;
  const out = { ...fallback } as Record<string, number>;
  for (const key of Object.keys(fallback)) {
    const n = num((value as Record<string, unknown>)[key], Number.NaN);
    if (!Number.isFinite(n) || n < 0) return fallback;
    out[key] = n;
  }
  return out as T;
}

/** Reads the config rows. Anything missing or invalid falls back to the defaults. */
export function rankingConfigFrom(rows: ReadonlyArray<{ key: string; value: unknown }>): RankingConfig {
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const d = DEFAULT_RANKING_CONFIG;
  const np = byKey.get("ranking.new_provider");
  const npObj = np && typeof np === "object" ? (np as Record<string, unknown>) : {};
  return {
    normal: weightsFrom(byKey.get("ranking.normal"), d.normal),
    urgent: weightsFrom(byKey.get("ranking.urgent"), d.urgent),
    maxDistanceKm: Math.max(num(byKey.get("ranking.max_distance_km"), d.maxDistanceKm), 0.1),
    listSize: Math.min(20, Math.max(1, Math.floor(num(byKey.get("ranking.list_size"), d.listSize)))),
    reliability: weightsFrom(byKey.get("ranking.reliability"), d.reliability),
    newProvider: {
      minJobs: Math.max(0, Math.floor(num(npObj.min_jobs, d.newProvider.minJobs))),
      rating: Math.min(5, Math.max(1, num(npObj.rating, d.newProvider.rating))),
      reliability: Math.min(100, Math.max(0, num(npObj.reliability, d.newProvider.reliability))),
    },
  };
}
