"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import styles from "@/components/quotes/quotes.module.css";

/** Starts the deposit payment and sends the customer to the page where they pay. */
export function PayDeposit({ bookingId, amountText, retry }: { bookingId: string; amountText: string; retry?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/deposit`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) { setError(data?.error ?? "Could not start the payment. Try again."); setBusy(false); return; }
      window.location.assign(data.url);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <div className={styles.actions}>
        <Button variant="primary" loading={busy} onClick={pay}>{retry ? "Try again" : "Pay deposit"} {amountText}</Button>
      </div>
    </div>
  );
}
