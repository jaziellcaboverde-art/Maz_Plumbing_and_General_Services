"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import styles from "./quotes.module.css";

/** The customer answers an approved quote. Declining cancels the request, so it asks first. */
export function QuoteResponse({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function answer(accept: boolean) {
    if (busy) return;
    setBusy(accept ? "accept" : "decline"); setError(null);
    const message = await postJson(`/api/quotes/${quoteId}/respond`, { accept, reason });
    setBusy(null);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      {confirming && (
        <>
          <StatusMessage status="warning">Declining cancels this booking. You can write why, which is optional.</StatusMessage>
          <Textarea label="Reason (optional)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </>
      )}
      <div className={styles.actions}>
        <Button variant="primary" loading={busy === "accept"} disabled={!!busy} onClick={() => answer(true)}>Accept quote</Button>
        {!confirming
          ? <Button disabled={!!busy} onClick={() => setConfirming(true)}>Decline quote</Button>
          : <Button loading={busy === "decline"} disabled={!!busy} onClick={() => answer(false)}>Yes, decline and cancel</Button>}
      </div>
    </div>
  );
}
