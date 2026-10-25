import { describe, expect, test } from "vitest";
import {
  DEFAULT_RANKING_CONFIG as cfg, rankCandidates, reliabilityScore, scoreCandidate, starsFor,
  type Candidate,
} from "@/lib/matching/score";

function provider(over: Partial<Candidate> = {}): Candidate {
  return {
    providerId: "p1", firstName: "Ana", lastInitial: "D", dailyRate: 1200, distanceM: 2000,
    reviewCount: 10, avgStars: 4.6, finishedJobs: 12, offersTotal: 10, offersAccepted: 10,
    providerCancels: 0, arrivalsTotal: 10, arrivalsOnTime: 10, interested: false, ...over,
  };
}

describe("reliability formula (step 7.1, Q27)", () => {
  test("weights are 40 / 30 / 20 / 10 and add up to 100", () => {
    const w = cfg.reliability;
    expect(w).toEqual({ accept_rate: 40, on_time: 30, no_cancel: 20, no_show: 10 });
    expect(w.accept_rate + w.on_time + w.no_cancel + w.no_show).toBe(100);
  });

  test("a perfect record scores 100", () => {
    expect(reliabilityScore(provider(), cfg)).toBe(100);
  });

  test("declining half the offers costs 20 points", () => {
    expect(reliabilityScore(provider({ offersAccepted: 5 }), cfg)).toBeCloseTo(80);
  });

  test("being late half the time costs 15 points", () => {
    expect(reliabilityScore(provider({ arrivalsOnTime: 5 }), cfg)).toBeCloseTo(85);
  });

  test("cancelling 2 of 12 jobs lowers the no-cancel part", () => {
    expect(reliabilityScore(provider({ finishedJobs: 10, providerCancels: 2 }), cfg)).toBeCloseTo(100 - 20 * (2 / 12));
  });
});

describe("new providers (step 7.2)", () => {
  test("under 3 finished jobs start at 4.0 stars and 70 reliability", () => {
    const fresh = provider({ finishedJobs: 2, reviewCount: 2, avgStars: 5, offersAccepted: 0 });
    expect(starsFor(fresh, cfg)).toBe(4);
    expect(reliabilityScore(fresh, cfg)).toBe(70);
    expect(scoreCandidate(fresh, "normal", cfg).isNew).toBe(true);
  });

  test("with 3 finished jobs the real numbers count", () => {
    const real = provider({ finishedJobs: 3, avgStars: 4.9 });
    expect(starsFor(real, cfg)).toBe(4.9);
    expect(scoreCandidate(real, "normal", cfg).isNew).toBe(false);
  });
});

describe("ranking order (steps 7.3 to 7.6)", () => {
  test("closer wins when everything else is equal", () => {
    const ranked = rankCandidates([provider({ providerId: "far", distanceM: 9000 }), provider({ providerId: "near", distanceM: 1000 })], "normal", cfg);
    expect(ranked.map((r) => r.providerId)).toEqual(["near", "far"]);
  });

  test("providers beyond the distance limit are left out", () => {
    const ranked = rankCandidates([provider({ providerId: "gone", distanceM: cfg.maxDistanceKm * 1000 + 1 })], "normal", cfg);
    expect(ranked).toEqual([]);
  });

  test("urgent jobs weigh distance more than normal jobs", () => {
    const near = provider({ providerId: "near", distanceM: 500, avgStars: 4.2 });
    const star = provider({ providerId: "star", distanceM: 9000, avgStars: 5 });
    expect(rankCandidates([near, star], "urgent", cfg)[0].providerId).toBe("near");
  });

  test("ties are broken by distance and then by id, so the order never flips", () => {
    const a = provider({ providerId: "a" });
    const b = provider({ providerId: "b" });
    expect(rankCandidates([b, a], "normal", cfg).map((r) => r.providerId)).toEqual(["a", "b"]);
  });

  test("scores stay between 0 and 100", () => {
    const worst = scoreCandidate(provider({ distanceM: cfg.maxDistanceKm * 1000, avgStars: 1, finishedJobs: 5, offersAccepted: 0, arrivalsOnTime: 0, providerCancels: 5 }), "normal", cfg);
    const best = scoreCandidate(provider({ distanceM: 0, avgStars: 5, finishedJobs: 50 }), "normal", cfg);
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(best.score).toBeLessThanOrEqual(100);
    expect(best.score).toBeGreaterThan(worst.score);
  });
});

describe("far providers who said yes (job alerts)", () => {
  const far = (id: string, interested: boolean) => provider({ providerId: id, distanceM: cfg.maxDistanceKm * 1000 + 8000, interested });

  test("with nobody near, providers who said yes are listed even when far", () => {
    const ranked = rankCandidates([far("yes", true), far("no", false)], "normal", cfg);
    expect(ranked.map((r) => r.providerId)).toEqual(["yes"]);
    expect(ranked[0].isFar).toBe(true);
  });

  test("near providers come first and far ones only fill the list", () => {
    const near = [1, 2, 3].map((n) => provider({ providerId: `near${n}`, distanceM: 1000 * n }));
    const ranked = rankCandidates([...near, far("yes", true)], "normal", cfg);
    expect(ranked.map((r) => r.providerId)).toEqual(["near1", "near2", "near3", "yes"]);
  });

  test("a full list of near providers keeps far ones out", () => {
    const near = Array.from({ length: cfg.listSize }, (_, n) => provider({ providerId: `n${n}`, distanceM: 500 * (n + 1) }));
    expect(rankCandidates([...near, far("yes", true)], "normal", cfg).some((r) => r.isFar)).toBe(false);
  });
});
