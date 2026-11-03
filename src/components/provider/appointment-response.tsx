"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import styles from "./workspace.module.css";
export function AppointmentResponse({
  bookingId,
  proposalId,
}: {
  bookingId: string;
  proposalId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function answer(accept: boolean) {
    if (busy) return;
    setBusy(true);
    const error = await postJson(
      `/api/bookings/${bookingId}/appointment-response`,
      { proposalId, accept },
    );
    setError(error);
    setBusy(false);
    if (!error) router.refresh();
  }
  return (
    <div className={styles.form}>
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button disabled={busy} loading={busy} onClick={() => answer(true)}>
          Accept proposed period
        </Button>
        <Button disabled={busy} onClick={() => answer(false)}>
          Decline proposed period
        </Button>
      </div>
    </div>
  );
}
