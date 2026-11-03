"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/matching/client";
import { Button } from "@/components/ui/button";
import styles from "./workspace.module.css";
export function PrivateFeedbackForm({
  bookingId,
  workers,
}: {
  bookingId: string;
  workers: { provider_id: string; display_name: string; submitted: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = workers.filter((w) => !w.submitted);
  return (
    <section className={styles.card}>
      <h2>Optional private worker feedback</h2>
      <p>
        Separate from your MAZ review. Only MAZ, you and the worker you select
        can read this feedback.
      </p>
      {!remaining.length ? (
        <p>Thank you. Your worker feedback has been submitted privately.</p>
      ) : (
        <form
          className={styles.form}
          onSubmit={async (event) => {
            event.preventDefault();
            if (busy) return;
            const form = new FormData(event.currentTarget);
            setBusy(true);
            const error = await postJson(
              `/api/bookings/${bookingId}/provider-feedback`,
              {
                providerId: form.get("worker"),
                stars: Number(form.get("stars")),
                comment: form.get("comment"),
              },
            );
            setMessage(error ?? "Private feedback submitted.");
            setBusy(false);
            if (!error) router.refresh();
          }}
        >
          <label>
            Assigned worker
            <select name="worker" required>
              <option value="">Select a worker</option>
              {remaining.map((w) => (
                <option key={w.provider_id} value={w.provider_id}>
                  {w.display_name || "MAZ worker"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Rating
            <select name="stars" required>
              <option value="">Choose a rating</option>
              {[1, 2, 3, 4, 5].map((value) => (
                <option value={value} key={value}>
                  {value} out of 5
                </option>
              ))}
            </select>
          </label>
          <label>
            Private comment (optional)
            <textarea name="comment" maxLength={2000} />
          </label>
          {message && <p role="status">{message}</p>}
          <Button type="submit" loading={busy} disabled={busy}>
            Send private feedback
          </Button>
        </form>
      )}
    </section>
  );
}
