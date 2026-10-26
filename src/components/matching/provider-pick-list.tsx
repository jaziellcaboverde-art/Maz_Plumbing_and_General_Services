"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusMessage } from "@/components/ui/status-message";
import { kmAway, pesos, ratingText } from "@/lib/matching/format";
import { postJson } from "@/lib/matching/client";
import { cx } from "@/lib/cx";
import styles from "./matching.module.css";

export type PickOption = {
  providerId: string;
  name: string;
  stars: number;
  reviewCount: number;
  finishedJobs: number;
  distanceM: number;
  dailyRate: number | null;
  isNew: boolean;
  isFar?: boolean;
};

/** The ranked list the customer picks from (normal jobs). The best match is first. */
export function ProviderPickList({ bookingId, options }: { bookingId: string; options: PickOption[] }) {
  const router = useRouter();
  const [autoChain, setAutoChain] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(providerId: string) {
    if (busyId) return;
    setBusyId(providerId);
    setError(null);
    const message = await postJson(`/api/bookings/${bookingId}/pick`, { providerId, autoChain });
    if (message) {
      setError(message);
      setBusyId(null);
      router.refresh();
      return;
    }
    router.replace(`/customer/bookings/${bookingId}`);
    router.refresh();
  }

  return (
    <div className={styles.section}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <ul className={styles.list} aria-label="Providers near you, best match first">
        {options.map((option, index) => (
          <li key={option.providerId} className={cx(styles.card, index === 0 && styles.top)}>
            <div className={styles.head}>
              <span className={styles.name}>{option.name}</span>
              {index === 0 && <span className={styles.tag}>Best match</span>}
              {option.isNew && <span className={styles.tag}>New provider</span>}
              {option.isFar && <span className={styles.tag}>Farther away, but accepted the job</span>}
            </div>
            <div className={styles.facts}>
              <span>{ratingText(option.stars, option.reviewCount)}</span>
              <span>{option.finishedJobs === 1 ? "1 job finished" : `${option.finishedJobs} jobs finished`}</span>
              <span>{kmAway(option.distanceM)}</span>
              <span>{pesos(option.dailyRate)}</span>
            </div>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="primary"
                loading={busyId === option.providerId}
                disabled={busyId !== null}
                onClick={() => pick(option.providerId)}
              >
                Choose {option.name}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Checkbox
        label="If this provider cannot take the job, offer it to the next best provider automatically"
        checked={autoChain}
        onChange={(event) => setAutoChain(event.target.checked)}
      />
    </div>
  );
}
