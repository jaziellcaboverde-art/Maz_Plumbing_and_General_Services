import { requireAdmin, UUID } from "@/lib/matching/http";
import { rankedCandidates } from "@/lib/matching/engine";

/** Admin-only preview. The existing database matching policy remains authoritative. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  if (!UUID.test(id))
    return Response.json({ error: "Invalid booking." }, { status: 400 });
  const excluded =
    new URL(_request.url).searchParams
      .get("exclude")
      ?.split(",")
      .filter(Boolean) ?? [];
  if (excluded.length > 100 || excluded.some((value) => !UUID.test(value)))
    return Response.json(
      { error: "Invalid worker selection." },
      { status: 400 },
    );
  try {
    const eligible = await rankedCandidates(id);
    const excludedIds = new Set(excluded);
    const available = eligible.filter((p) => !excludedIds.has(p.providerId));
    const selection = {
      eligible_count: eligible.length,
      eligible_provider_ids: eligible.map((p) => p.providerId),
      remaining_count: available.length,
    };
    const baseline = available.slice(0, 3).map((p, i) => ({
      provider_id: p.providerId,
      rank: i + 1,
      name: `${p.firstName} ${p.lastInitial}`.trim(),
      distance_km: Number.isFinite(p.distanceM) ? p.distanceM / 1000 : null,
      score: p.score,
    }));
    const fallback = (reason: string) =>
      Response.json(
        {
          mode: "rule_based",
          note: reason,
          top_three: baseline,
          ...selection,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (available.length === 0)
      return fallback(
        eligible.length
          ? "All eligible providers are already selected or assigned."
          : "No eligible providers. Reschedule or review provider coverage.",
      );
    if (process.env.KUMPUNINJA_ML_EXPERIMENTAL !== "true")
      return fallback(
        "Operational rule-based recommendations. Experimental ML is disabled.",
      );
    const url = process.env.ML_API_URL;
    const key = process.env.KUMPUNINJA_ML_KEY;
    if (!url || !key)
      return fallback(
        "ML is not configured. Rule-based recommendations are available.",
      );
    // Do not fabricate unavailable history. Use only real attributes available in matching_candidates.
    const candidates = available
      .filter((p) => Number.isFinite(p.distanceM))
      .map((p) => ({
        provider_id: p.providerId,
        distance_km: p.distanceM / 1000,
        average_customer_rating: p.avgStars ?? 0,
        prior_jobs_completed: p.finishedJobs,
      }));
    if (
      candidates.length > 100 ||
      candidates.some(
        (p) =>
          p.distance_km < 0 ||
          p.distance_km > 500 ||
          !Number.isFinite(p.average_customer_rating) ||
          p.average_customer_rating < 0 ||
          p.average_customer_rating > 5 ||
          !Number.isInteger(p.prior_jobs_completed) ||
          p.prior_jobs_completed < 0,
      ) ||
      candidates.length !== available.length
    )
      return fallback(
        "Some candidate distances are unavailable; rule-based ranking retained.",
      );
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      let response: Response;
      let result: unknown;
      try {
        response = await fetch(`${url.replace(/\/$/, "")}/rank`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-ML-Key": key },
          body: JSON.stringify({ booking_id: id, candidates }),
          signal: controller.signal,
          cache: "no-store",
        });
        result = await response.json();
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok)
        return fallback(
          "Experimental ML unavailable; rule-based recommendations retained.",
        );

      if (
        !result ||
        typeof result !== "object" ||
        !("booking_id" in result) ||
        result.booking_id !== id ||
        !("mode" in result) ||
        result.mode !== "synthetic_experimental" ||
        !("top_three" in result) ||
        !Array.isArray(result.top_three) ||
        result.top_three.length > 3
      )
        return fallback(
          "Invalid ML response; rule-based recommendations retained.",
        );
      const lookup = new Map(available.map((p) => [p.providerId, p]));
      const seen = new Set<string>();
      const top = [];
      for (const item of result.top_three) {
        if (!item || typeof item !== "object")
          return fallback(
            "Invalid ML candidates; rule-based ranking retained.",
          );
        const pid = (item as { provider_id?: unknown }).provider_id;
        if (typeof pid !== "string" || seen.has(pid) || !lookup.has(pid))
          return fallback(
            "ML returned an ineligible provider; rule-based ranking retained.",
          );
        seen.add(pid);
        const p = lookup.get(pid)!;
        top.push({
          provider_id: pid,
          rank: top.length + 1,
          name: `${p.firstName} ${p.lastInitial}`.trim(),
          distance_km: p.distanceM / 1000,
        });
      }
      if (top.length !== Math.min(3, available.length))
        return fallback("Incomplete ML response; rule-based ranking retained.");
      return Response.json(
        {
          mode: "synthetic_experimental",
          top_three: top,
          ...selection,
          note: "Experimental synthetic-trained model; not validated on real MAZ outcomes. Assignments are not automated.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return fallback(
        "Experimental ML timed out; rule-based recommendations retained.",
      );
    }
  } catch {
    return Response.json(
      { error: "Could not load eligible providers." },
      { status: 503 },
    );
  }
}
