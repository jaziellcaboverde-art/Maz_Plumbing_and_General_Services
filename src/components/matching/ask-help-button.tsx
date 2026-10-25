"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusMessage } from "@/components/ui/status-message";
import { postJson } from "@/lib/matching/client";

/** The customer asks the team to find a provider (nobody nearby, or they prefer not to choose). */
export function AskHelpButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    const message = await postJson(`/api/bookings/${bookingId}/help`, {});
    setBusy(false);
    if (message) { setError(message); return; }
    router.refresh();
  }

  return (
    <div>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Button type="button" loading={busy} disabled={busy} onClick={ask}>Ask our team to find a provider</Button>
    </div>
  );
}
