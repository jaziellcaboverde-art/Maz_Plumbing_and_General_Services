"use client";

import { manilaInputToISO } from "@/lib/provider/time";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { StatusMessage } from "@/components/ui/status-message";
import styles from "@/components/provider/workspace.module.css";

export function AvailabilityForm() {
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [kind, setKind] = useState<"available" | "unavailable">("available");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    setSaved(false);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      setError("Choose an end time after the start time.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/provider/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: manilaInputToISO(startsAt),
          endsAt: manilaInputToISO(endsAt),
          kind,
          note,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(body?.error ?? "Could not save availability.");
        return;
      }
      setStartsAt("");
      setEndsAt("");
      setNote("");
      setSaved(true);
      toast.show({ status: "success", message: "Availability saved." });
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <h2>Add a dated exception</h2>
      <p>Philippine time. Report conflicts with existing assignments to MAZ.</p>
      <label htmlFor="availability-kind">Period</label>
      <select
        id="availability-kind"
        value={kind}
        onChange={(event) => setKind(event.target.value as typeof kind)}
      >
        <option value="available">Available</option>
        <option value="unavailable">Unavailable</option>
      </select>
      <label htmlFor="availability-start">Starts</label>
      <input
        id="availability-start"
        type="datetime-local"
        value={startsAt}
        onChange={(event) => setStartsAt(event.target.value)}
        required
      />
      <label htmlFor="availability-end">Ends</label>
      <input
        id="availability-end"
        type="datetime-local"
        value={endsAt}
        onChange={(event) => setEndsAt(event.target.value)}
        required
      />
      <label htmlFor="availability-note">Note (optional)</label>
      <input
        id="availability-note"
        value={note}
        maxLength={300}
        placeholder="e.g. Personal leave or extra available hours"
        onChange={(event) => setNote(event.target.value)}
      />
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>
        Save period
      </Button>
      {saved && <p role="status">Saved.</p>}
    </form>
  );
}
