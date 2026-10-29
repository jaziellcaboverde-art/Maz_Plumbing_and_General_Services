"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { postJson } from "@/lib/matching/client";
import { kmAway, pesos, ratingText } from "@/lib/matching/format";
import styles from "./matching.module.css";

export type AssignOption = {
  providerId: string;
  name: string;
  stars: number | null;
  reviewCount: number;
  distanceM: number | null;
  dailyRate: number | null;
  ranked: boolean;
  interested?: boolean;
};

/** Admin: offer a waiting job (or the foreman role on a large job) to one provider. */
export function AssignPanel({ bookingId, options, large }: { bookingId: string; options: AssignOption[]; large: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function assign(providerId: string) {
    if (busyId) return;
    setBusyId(providerId);
    setError(null);
    const message = await postJson(`/api/admin/bookings/${bookingId}/assign`, { providerId });
    setBusyId(null);
    if (message) { setError(message); return; }
    router.refresh();
  }

  if (options.length === 0) return <p className={styles.muted}>No approved provider offers this service yet.</p>;
  return (
    <div className={styles.section}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <ul className={styles.list} aria-label={large ? "Possible foremen" : "Possible providers"}>
        {options.map((option, index) => (
          <li key={option.providerId} className={styles.card}>
            <div className={styles.head}>
              <span className={styles.name}>{option.name}</span>
              {option.ranked && index === 0 && <span className={styles.tag}>Best match</span>}
              {option.interested && <span className={styles.tag}>Said they can do it</span>}
              {!option.ranked && <span className={styles.tag}>Outside the usual distance</span>}
            </div>
            <div className={styles.facts}>
              <span>{option.stars === null ? "No reviews yet" : ratingText(option.stars, option.reviewCount)}</span>
              <span>{kmAway(option.distanceM)}</span>
              <span>{pesos(option.dailyRate)}</span>
            </div>
            <div className={styles.actions}>
              <Button type="button" variant="primary" loading={busyId === option.providerId} disabled={busyId !== null} onClick={() => assign(option.providerId)}>
                {large ? "Offer foreman role" : "Offer job"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
