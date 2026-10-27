"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import styles from "./quotes.module.css";

/** Step 9.4: the admin approves (and may change the class) or sends the quote back with a reason. */
export function QuoteDecision({ quoteId, proposedClass }: { quoteId: string; proposedClass: "minor" | "major" }) {
  const router = useRouter();
  const [jobClass, setJobClass] = useState<"minor" | "major">(proposedClass);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "back" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const noteShort = note.trim().length < 10;

  async function decide(approve: boolean) {
    if (busy) return;
    setBusy(approve ? "approve" : "back"); setError(null);
    const message = await postJson(`/api/quotes/${quoteId}/decide`, { approve, note, jobClass });
    setBusy(null);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Select label="Class" value={jobClass} onChange={(e) => setJobClass(e.target.value as "minor" | "major")}
        hint="Changing the class can change the payment tier. The price stays the provider's.">
        <option value="minor">Minor</option>
        <option value="major">Major</option>
      </Select>
      <Textarea label="Note (needed to send back)" hint="Tell the provider what to fix. At least 10 characters." value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      <div className={styles.actions}>
        <Button variant="primary" loading={busy === "approve"} disabled={!!busy} onClick={() => decide(true)}>Approve quote</Button>
        <Button loading={busy === "back"} disabled={!!busy || noteShort} disabledReason={noteShort ? "Write why, at least 10 characters." : undefined} onClick={() => decide(false)}>Send back</Button>
      </div>
    </div>
  );
}
