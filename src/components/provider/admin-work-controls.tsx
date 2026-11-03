"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
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

export function TeamOfferForm({
  bookings,
  providers,
}: {
  bookings: { id: string; label: string }[];
  providers: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        setMessage(null);
        const error = await postJson(
          `/api/admin/bookings/${form.get("booking")}/team`,
          {
            providerId: form.get("provider"),
            trade: form.get("trade"),
            phase: form.get("phase"),
            startsAt: manilaInputToISO(String(form.get("start"))),
            endsAt: manilaInputToISO(String(form.get("end"))),
            expiresAt: manilaInputToISO(String(form.get("expiry"))),
            travelMinutes: Number(form.get("buffer")),
          },
        );
        setMessage(
          error ??
            "Assignment offered. The worker must accept before MAZ confirms the team.",
        );
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <h2>Offer a project role</h2>
      <label htmlFor="team-booking">Booking</label>
      <select name="booking" id="team-booking" required>
        <option value="">Select booking</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <label htmlFor="team-provider">Worker</label>
      <select name="provider" id="team-provider" required>
        <option value="">Select worker</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <label htmlFor="team-trade">Role / trade</label>
      <input
        name="trade"
        id="team-trade"
        minLength={2}
        maxLength={120}
        required
      />
      <label htmlFor="team-phase">Phase</label>
      <select name="phase" id="team-phase">
        <option value="inspection">Inspection</option>
        <option value="execution">Execution</option>
      </select>
      <label htmlFor="team-expiry">Offer deadline (24–48 hours from now)</label>
      <input name="expiry" id="team-expiry" type="datetime-local" required />
      <label htmlFor="team-start">Work starts (after deadline)</label>
      <input name="start" id="team-start" type="datetime-local" required />
      <label htmlFor="team-end">Work ends</label>
      <input name="end" id="team-end" type="datetime-local" required />
      <label htmlFor="team-buffer">Travel buffer (minutes)</label>
      <input
        name="buffer"
        id="team-buffer"
        type="number"
        min={0}
        max={240}
        defaultValue={30}
        required
      />
      <p className={styles.muted}>
        All times use Asia/Manila. Qualification, working hours, leave, existing
        work and offer holds are checked before offering and accepting.
      </p>
      {message && <p role="status">{message}</p>}
      <Button type="submit" disabled={busy} loading={busy}>
        Send assignment offer
      </Button>
    </form>
  );
}

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
          setMessage(error ?? "Quotation issued for customer approval.");
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
          <textarea name="scope" minLength={10} maxLength={4000} required />
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
}: {
  bookingId: string;
  leads: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        setBusy(true);
        const error = await postJson(
          `/api/admin/bookings/${bookingId}/appointment`,
          { leadId: form.get("lead") },
        );
        setMessage(error ?? "MAZ appointment confirmed.");
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <label>
        Accepted lead provider
        <select name="lead" required>
          <option value="">Select accepted worker</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        Confirm the requested inspection or a customer-approved work period.
        Execution also requires approved scope, the configured deposit and
        accepted execution roles.
      </p>
      {message && <p role="status">{message}</p>}
      <Button type="submit" loading={busy} disabled={busy}>
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
      <summary>Add a work milestone</summary>
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
          setMessage(
            error ??
              "Work milestone added. Financial payment plans remain separate.",
          );
          setBusy(false);
          if (!error) router.refresh();
        }}
      >
        <label>
          Milestone title
          <input name="title" minLength={3} maxLength={120} required />
        </label>
        <label>
          Due (optional, Philippine time)
          <input name="due" type="datetime-local" />
        </label>
        {message && <p role="status">{message}</p>}
        <Button type="submit" loading={busy} disabled={busy}>
          Add work milestone
        </Button>
      </form>
    </details>
  );
}
