"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { postJson } from "@/lib/matching/client";
import styles from "@/components/quotes/quotes.module.css";

/** Test mode only. Stands in for the PayMongo page until real test keys are added. */
export function TestPayment({ paymentId, bookingId }: { paymentId: string; bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"paid" | "failed" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function finish(outcome: "paid" | "failed") {
    if (busy) return;
    setBusy(outcome); setError(null);
    const message = await postJson("/api/payments/mock", { paymentId, outcome });
    if (message) { setError(message); setBusy(null); return; }
    router.push(`/customer/bookings/${bookingId}`);
    router.refresh();
  }

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <div className={styles.actions}>
        <Button variant="primary" loading={busy === "paid"} disabled={!!busy} onClick={() => finish("paid")}>Pretend the payment worked</Button>
        <Button loading={busy === "failed"} disabled={!!busy} onClick={() => finish("failed")}>Pretend the payment failed</Button>
      </div>
    </div>
  );
}
