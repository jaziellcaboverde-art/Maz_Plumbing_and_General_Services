"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusMessage } from "@/components/ui/status-message";
import { postJson } from "@/lib/matching/client";
import styles from "./quotes.module.css";

/** The admin writes what they did (called the provider, warned, paused) and closes the flag. */
export function QualityFlagResolve({ flagId }: { flagId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    if (busy) return;
    setBusy(true); setError(null);
    const message = await postJson(`/api/admin/quality-flags/${flagId}/resolve`, { note });
    setBusy(false);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <div className={styles.form}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Input label="What did you do about it?" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} hint="For example: called the provider and gave a warning." />
      <div className={styles.actions}>
        <Button loading={busy} disabled={busy || note.trim().length < 5} onClick={resolve}>Close flag</Button>
      </div>
    </div>
  );
}
