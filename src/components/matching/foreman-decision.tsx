"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonGroup } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import styles from "./matching.module.css";

/** Admin answer to a foreman change request: approve with a new foreman, or decline with a reason. */
export function ForemanDecision({ requestId, options }: { requestId: string; options: Array<{ providerId: string; label: string }> }) {
  const router = useRouter();
  const [newProviderId, setNewProviderId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(approve ? "approve" : "decline");
    setError(null);
    const message = await postJson(`/api/admin/foreman-requests/${requestId}/decide`, { approve, note, newProviderId: approve ? newProviderId : null });
    setBusy(null);
    if (message) { setError(message); return; }
    router.refresh();
  }

  const selectId = `new-foreman-${requestId}`;
  return (
    <div className={styles.section}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <div>
        <label htmlFor={selectId}>New foreman (needed to approve)</label>
        <select id={selectId} className={styles.select} value={newProviderId} onChange={(event) => setNewProviderId(event.target.value)}>
          <option value="">Choose a provider</option>
          {options.map((option) => <option key={option.providerId} value={option.providerId}>{option.label}</option>)}
        </select>
      </div>
      <Textarea label="Note to the customer (required to decline)" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      <ButtonGroup>
        <Button type="button" variant="primary" loading={busy === "approve"} disabled={busy !== null || !newProviderId} disabledReason={!newProviderId ? "Choose a new foreman." : undefined} onClick={() => decide(true)}>Approve change</Button>
        <Button type="button" loading={busy === "decline"} disabled={busy !== null || note.trim().length < 5} disabledReason={note.trim().length < 5 ? "Write a short note to decline." : undefined} onClick={() => decide(false)}>Decline request</Button>
      </ButtonGroup>
    </div>
  );
}
