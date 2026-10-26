"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { dayAndTime, kmAway } from "@/lib/matching/format";
import { postJson } from "@/lib/matching/client";
import styles from "./matching.module.css";

export type RequestView = {
  bookingId: string;
  serviceName: string;
  description: string;
  preferredStart: string | null;
  area: string;
  distanceM: number | null;
  interested: boolean;
};

/** An open job that matches the provider's declared services. Accepting counts as a yes in advance; the customer then chooses among providers who accepted. */
export function RequestCard({ request }: { request: RequestView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(interested: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await postJson(`/api/bookings/${request.bookingId}/interest`, { interested });
    setBusy(false);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <li className={styles.card}>
      <div className={styles.head}>
        <span className={styles.name}>{request.serviceName}</span>
        {request.interested && <span className={styles.tag}>You accepted this job</span>}
      </div>
      <p>{request.description}</p>
      <div className={styles.facts}>
        <span>{request.area}</span>
        <span>{kmAway(request.distanceM)}</span>
        <span>{request.preferredStart ? dayAndTime(request.preferredStart) : "Date not set"}</span>
      </div>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <div className={styles.actions}>
        {request.interested
          ? <Button type="button" loading={busy} disabled={busy} onClick={() => set(false)}>Withdraw</Button>
          : <Button type="button" variant="primary" loading={busy} disabled={busy} onClick={() => set(true)}>Accept this job</Button>}
      </div>
    </li>
  );
}
