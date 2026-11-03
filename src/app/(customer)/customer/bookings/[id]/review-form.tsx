"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { StatusMessage } from "@/components/ui/status-message";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/browser";

/** Rate & Review (spec 3.H): 1 to 5 stars and a comment, once per booking. The server checks it is Completed. */
export function ReviewForm({ bookingId, providerName }: { bookingId: string; providerName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [stars, setStars] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!stars) {
      setError("Choose how many stars you give.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await createClient().rpc("submit_review", { p_booking_id: bookingId, p_stars: Number(stars), p_comment: comment });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || "Could not send your review. Try again.");
      return;
    }
    toast.show({ status: "success", message: "Review sent" });
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--space-2)" }}>
      {error && <StatusMessage status="error">{error}</StatusMessage>}
      <Select label={`Your rating for ${providerName}`} value={stars} onChange={(event) => setStars(event.target.value)} required>
        <option value="">Choose a rating</option>
        <option value="5">5 stars</option>
        <option value="4">4 stars</option>
        <option value="3">3 stars</option>
        <option value="2">2 stars</option>
        <option value="1">1 star</option>
      </Select>
      <Textarea label="Comment (optional)" value={comment} onChange={(event) => setComment(event.target.value)} />
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>Send review</Button>
    </form>
  );
}
