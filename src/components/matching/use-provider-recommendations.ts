"use client";

import { useEffect, useState } from "react";

export type ProviderRecommendations = {
  mode: "rule_based" | "synthetic_experimental";
  note: string;
  eligible_count: number;
  eligible_provider_ids: string[];
  top_three: {
    provider_id: string;
    name: string;
    distance_km: number | null;
  }[];
};

/** Keep results scoped to the current booking/selection and cancel obsolete requests. */
export function useProviderRecommendations(
  bookingId: string,
  excluded: string,
) {
  const [retry, setRetry] = useState(0);
  const query = excluded ? `?exclude=${encodeURIComponent(excluded)}` : "";
  const key = bookingId ? `${bookingId}${query}:${retry}` : "";
  const [state, setState] = useState<{
    key: string;
    result?: ProviderRecommendations;
    error?: string;
  }>({ key: "" });
  useEffect(() => {
    if (!bookingId) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/bookings/${bookingId}/ml-recommendations${query}`,
          { cache: "no-store", signal: controller.signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load recommendations.");
        if (
          !Array.isArray(data.top_three) ||
          !Array.isArray(data.eligible_provider_ids)
        )
          throw new Error("Could not load recommendations. Please retry.");
        if (active) setState({ key, result: data });
      } catch (error) {
        if (active)
          setState({
            key,
            error:
              error instanceof Error
                ? error.message
                : "Could not load recommendations.",
          });
      }
    }
    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [bookingId, key, query]);
  const current = state.key === key;
  return {
    result: current ? state.result : undefined,
    error: current ? state.error : undefined,
    loading: !!bookingId && !current,
    refresh: () => setRetry((value) => value + 1),
  };
}
