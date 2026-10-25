"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";

/** Large jobs: the customer asks for a different foreman and says why. The admin decides. */
export function ForemanChangeForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooShort = reason.trim().length < 10;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (tooShort || busy) return;
    setBusy(true);
    setError(null);
    const message = await postJson(`/api/bookings/${bookingId}/foreman-change`, { reason });
    setBusy(false);
    if (message) { setError(message); return; }
    setReason("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Textarea
        label="Why would you like a different foreman?"
        hint="An admin reads this and decides. At least 10 characters."
        value={reason}
        maxLength={500}
        onChange={(event) => setReason(event.target.value)}
      />
      <Button type="submit" loading={busy} disabled={busy || tooShort} disabledReason={tooShort ? "Write at least 10 characters." : undefined}>
        Ask for a different foreman
      </Button>
    </form>
  );
}
