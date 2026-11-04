"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AutoRefresh } from "@/components/matching/auto-refresh";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import styles from "./workspace.module.css";

export function WorkReviewControls({
  id,
  bookingId,
  completion,
}: {
  id: string;
  bookingId: string;
  completion: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function review(approve: boolean) {
    if (busy) return;
    setBusy(true);
    const error = await postJson(`/api/admin/provider-work-updates/${id}`, {
      approve,
      note,
    });
    setError(error);
    setBusy(false);
    if (!error) router.refresh();
  }
  return (
    <div className={styles.form}>
      <Textarea
        label="MAZ review note"
        placeholder="Example: Photos show the repaired connection and completed leak test. Findings match the approved scope. For corrections, specify the missing photo, unfinished work or clarification required."
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <div className={styles.actions}>
        <Button disabled={busy} loading={busy} onClick={() => review(true)}>
          Approve evidence
        </Button>
        <Button
          disabled={busy || note.trim().length < 5}
          onClick={() => review(false)}
        >
          Request corrections
        </Button>
      </div>
      {completion && (
        <p>
          Approving this evidence completes this worker&apos;s assignment.
          Parent booking sign-off is separate.
        </p>
      )}
      <span className={styles.muted}>Booking {bookingId}</span>
    </div>
  );
}

export function ProjectSignoff({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={styles.form}>
      {error && <p role="alert">{error}</p>}
      <Button
        disabled={busy}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          const error = await postJson(
            `/api/admin/bookings/${bookingId}/completion`,
            {},
          );
          setError(error);
          setBusy(false);
          if (!error) router.refresh();
        }}
      >
        Verify and sign off project completion
      </Button>
      <p>
        Requires approved completion evidence from the lead, completed team
        assignments and approved milestones. Financial settlement stays
        separate.
      </p>
    </div>
  );
}

export { TeamOfferForm } from "./team-offer-form";

export function MazQuoteForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <details>
      <summary>Prepare MAZ quotation</summary>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          setBusy(true);
          const error = await postJson(
            `/api/admin/bookings/${bookingId}/quote`,
            {
              amount: Number(form.get("amount")),
              deposit: Number(form.get("deposit")),
              notes: form.get("scope"),
              expiresAt: manilaInputToISO(String(form.get("validity"))),
            },
          );
          setMessage(error ?? "Quotation issued and approved by MAZ.");
          setBusy(false);
          if (!error) router.refresh();
        }}
      >
        <label>
          Total (PHP)
          <input
            name="amount"
            type="number"
            min={1}
            max={10000000}
            step="0.01"
            required
          />
        </label>
        <label>
          Required deposit (PHP)
          <input name="deposit" type="number" min={0} step="0.01" required />
        </label>
        <label>
          Scope, inclusions, exclusions and estimated duration
          <textarea
            name="scope"
            minLength={10}
            maxLength={4000}
            required
            placeholder="Example: Replace the damaged sink trap. Includes labor, agreed replacement part and leak testing. Excludes hidden pipe repairs and wall restoration. Estimated duration: one work day."
          />
        </label>
        <label>
          Valid until (Philippine time)
          <input name="validity" type="datetime-local" required />
        </label>
        <p>
          Set the approved payment requirement for this project. No automatic
          tier or universal deposit applies. Accepted quotations stay unchanged.
        </p>
        {message && <p role="status">{message}</p>}
        <Button type="submit" loading={busy} disabled={busy}>
          Issue quotation
        </Button>
      </form>
    </details>
  );
}

export function MazAppointmentForm({
  bookingId,
  leads,
  phase = "inspection",
  waiting = [],
  blockedReasons = [],
}: {
  bookingId: string;
  leads: { id: string; label: string }[];
  phase?: string;
  waiting?: { name: string; status: string }[];
  blockedReasons?: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const selected = leads.filter((l) => !excluded.includes(l.id));
  const lead = selected[0]?.id ?? "";
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || !lead || blockedReasons.length) return;
        setBusy(true);
        const error = await postJson(
          `/api/admin/bookings/${bookingId}/appointment`,
          { leadIds: selected.map((l) => l.id) },
        );
        setMessage(error ?? "MAZ appointment confirmed.");
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <fieldset className={styles.card} disabled={busy}>
        <legend>Assigned workers ({phase})</legend>
        {leads.map((worker) => (
          <label key={worker.id}>
            <input
              type="checkbox"
              checked={!excluded.includes(worker.id)}
              onChange={(event) =>
                setExcluded((current) =>
                  event.target.checked
                    ? current.filter((id) => id !== worker.id)
                    : [...current, worker.id],
                )
              }
            />
            {worker.label}
          </label>
        ))}
        {!leads.length && (
          <p role="status">
            Assign workers above first. Provider acceptance is not required.
          </p>
        )}
        <small>
          All selected workers are confirmed together. The first worker is the
          primary contact.
        </small>
      </fieldset>
      {(!leads.length || waiting.length > 0 || blockedReasons.length > 0) && (
        <AutoRefresh />
      )}
      {waiting.length > 0 && (
        <>
          <p>Assignments needing review:</p>
          <ul>
            {waiting.map((w, index) => (
              <li key={index}>
                {w.name} — {w.status.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </>
      )}
      {blockedReasons.length > 0 && (
        <>
          <p>Before MAZ can confirm:</p>
          <ul>
            {blockedReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </>
      )}
      {message && <p role="status">{message}</p>}
      <Button
        type="submit"
        loading={busy}
        disabled={busy || !lead || blockedReasons.length > 0}
      >
        Confirm MAZ appointment
      </Button>
    </form>
  );
}

export function WorkMilestoneForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <details>
      <summary>Add a work checkpoint (optional)</summary>
      <form
        className={styles.form}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          const form = new FormData(event.currentTarget);
          setBusy(true);
          const error = await postJson(
            `/api/admin/bookings/${bookingId}/milestones`,
            {
              title: form.get("title"),
              dueAt: form.get("due")
                ? manilaInputToISO(String(form.get("due")))
                : null,
            },
          );
          setMessage(error ?? "Work checkpoint added.");
          setBusy(false);
          if (!error) router.refresh();
        }}
      >
        <label>
          Work checkpoint
          <input
            name="title"
            minLength={3}
            maxLength={120}
            required
            placeholder="Example: Rough-in piping installed and pressure-tested"
          />
        </label>
        <label>
          Due (optional, Philippine time)
          <input name="due" type="datetime-local" />
        </label>
        {message && <p role="status">{message}</p>}
        <Button type="submit" loading={busy} disabled={busy}>
          Add checkpoint
        </Button>
      </form>
    </details>
  );
}
