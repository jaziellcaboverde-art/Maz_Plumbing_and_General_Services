"use client";

import { Button } from "@/components/ui/button";
import type { ProviderRecommendations } from "./use-provider-recommendations";
import styles from "./provider-recommendation-picker.module.css";

export function ProviderRecommendationPicker({
  result,
  loading,
  error,
  onRetry,
  onSelect,
  providers,
  worker,
  disabled,
  trade,
}: {
  result?: ProviderRecommendations;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onSelect: (providerId: string) => void;
  providers: { id: string; label: string }[];
  worker: number;
  disabled: boolean;
  trade?: string;
}) {
  return (
    <section
      className={styles.panel}
      aria-label="Provider recommendations"
      aria-busy={loading}
    >
      <div className={styles.head}>
        <h3>Recommended providers</h3>
        <span className={styles.muted}>For worker {worker}</span>
      </div>
      <p className={styles.muted}>
        Ranked suggestions update as you build your team.
      </p>
      {loading && <p role="status">Finding recommended providers…</p>}
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button type="button" onClick={onRetry} disabled={disabled}>
            Retry recommendations
          </Button>
        </>
      )}
      {result && (
        <div aria-live="polite" className={styles.results}>
          <div className={styles.head}>
            <span className={styles.source}>
              {result.mode === "synthetic_experimental"
                ? "Experimental LightGBM ranking"
                : "Rule-based recommendations"}
            </span>
            <span className={styles.muted}>
              {result.eligible_count} eligible
            </span>
          </div>
          {result.mode === "synthetic_experimental" && (
            <p>Experimental ranking trained on synthetic data.</p>
          )}
          {result.top_three.length ? (
            <ol className={styles.list}>
              {result.top_three.map((candidate, index) => {
                const name =
                  providers.find((p) => p.id === candidate.provider_id)
                    ?.label ?? candidate.name;
                return (
                  <li key={candidate.provider_id} className={styles.card}>
                    <span className={styles.rank}>#{index + 1}</span>
                    <div className={styles.identity}>
                      <strong>{name}</strong>
                      <span className={styles.muted}>
                        Eligible · {trade ?? "Booked service specialist"}
                      </span>
                    </div>
                    <div className={styles.actions}>
                      <span className={styles.muted}>
                        {candidate.distance_km === null
                          ? "Distance unavailable"
                          : `${candidate.distance_km.toFixed(1)} km`}
                      </span>{" "}
                      <Button
                        type="button"
                        aria-label={`Select ${name} for worker ${worker}`}
                        disabled={disabled}
                        onClick={() => onSelect(candidate.provider_id)}
                      >
                        Select
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className={styles.empty}>
              <p>
                {result.eligible_count
                  ? "All eligible providers are already selected or assigned."
                  : "No eligible providers found."}
              </p>
              <p className={styles.muted}>
                Review the work schedule below or check provider coverage before
                sending offers.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
