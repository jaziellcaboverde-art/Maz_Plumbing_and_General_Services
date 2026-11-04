"use client";
import { ActionLink } from "@/components/ui/action-link";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import type { TeamAssignment } from "@/lib/provider/team";
import { AvailableSchedulePicker } from "./available-schedule-picker";
import styles from "./workspace.module.css";
type WorkerRow = { key: number; providerId: string; trade: string };
const HOUR = 60 * 60 * 1000;
function manilaInput(timestamp: number) {
  return new Date(timestamp + 8 * HOUR).toISOString().slice(0, 16);
}
export function TeamOfferForm({
  bookings,
  providers,
  serviceLabel = "this booking's service",
  existingAssignments = [],
  initialPhase = "inspection",
}: {
  bookings: { id: string; label: string }[];
  providers: { id: string; label: string }[];
  serviceLabel?: string;
  existingAssignments?: TeamAssignment[];
  initialPhase?: string;
}) {
  const router = useRouter(),
    id = useId();
  const [booking, setBooking] = useState(
    bookings.length === 1 ? bookings[0].id : "",
  );
  const [phase, setPhase] = useState(initialPhase);
  const [expiry, setExpiry] = useState("");
  const [buffer, setBuffer] = useState(30);
  const [expiryBounds, setExpiryBounds] = useState({ min: "", max: "" });
  function refreshExpiryBounds() {
    const now = Date.now();
    setExpiryBounds({
      min: manilaInput(now + 24 * HOUR + 60000),
      max: manilaInput(now + 48 * HOUR),
    });
    return now;
  }
  const [workers, setWorkers] = useState<WorkerRow[]>([
    { key: 0, providerId: "", trade: "" },
  ]);
  const next = useRef(1),
    request = useRef<{ payload: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const reserved = existingAssignments.filter(
    (a) =>
      a.phase === phase &&
      ["offered", "accepted", "withdrawal_requested"].includes(a.status),
  );
  function update(key: number, change: Partial<WorkerRow>) {
    setWorkers((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }
  return (
    <form
      className={styles.form}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        const expiresAt = manilaInputToISO(String(form.get("expiry")));
        const now = refreshExpiryBounds();
        const deadline = expiresAt ? Date.parse(expiresAt) : NaN;
        if (
          !Number.isFinite(deadline) ||
          deadline < now + 24 * HOUR ||
          deadline > now + 48 * HOUR
        ) {
          setMessage(
            "Choose a deadline 24–48 hours from now, or use the recommended deadline below. All times are Philippine time.",
          );
          return;
        }
        const startsAt = String(form.get("start") ?? "");
        const endsAt = String(form.get("end") ?? "");
        if (!startsAt || Date.parse(startsAt) <= deadline) {
          setMessage(
            "Choose an available work schedule after the offer deadline.",
          );
          return;
        }
        if (!endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) {
          setMessage("Team work must end after it starts.");
          return;
        }
        const data = {
          workers: workers.map(({ providerId, trade }) => ({
            providerId,
            trade: trade.trim(),
          })),
          phase,
          startsAt,
          endsAt,
          expiresAt,
          travelMinutes: Number(form.get("buffer")),
        };
        const payload = JSON.stringify({ booking, ...data });
        if (request.current?.payload !== payload)
          request.current = { payload, key: crypto.randomUUID() };
        setBusy(true);
        setMessage(null);
        try {
          const error = await postJson(`/api/admin/bookings/${booking}/team`, {
            ...data,
            key: request.current.key,
          });
          setMessage(
            error ??
              `${workers.length} worker offer(s) sent. Each worker must accept in Provider → Offers before MAZ confirms the appointment.`,
          );
          if (!error) {
            request.current = null;
            setWorkers([{ key: next.current++, providerId: "", trade: "" }]);
            router.refresh();
          }
        } catch {
          setMessage(
            "Could not confirm the response. Retry the same team or refresh to check existing offers.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Assign team</h2>
      {!providers.length && (
        <p>
          No approved workers are qualified for {serviceLabel} yet.{" "}
          <ActionLink href="/admin/provider-applications">
            Review provider qualifications
          </ActionLink>{" "}
          before sending offers. The worker list only includes providers approved
          for this booking&apos;s service.
        </p>
      )}
      <p>
        Add qualified workers and their role for {serviceLabel}. Each worker
        must accept their offer.
      </p>
      <label htmlFor={`${id}-booking`}>Booking</label>
      <select
        id={`${id}-booking`}
        value={booking}
        required
        disabled={busy}
        onChange={(e) => setBooking(e.target.value)}
      >
        <option value="">Select booking</option>
        {bookings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.label}
          </option>
        ))}
      </select>
      <label htmlFor={`${id}-phase`}>Phase</label>
      <select
        id={`${id}-phase`}
        value={phase}
        disabled={busy}
        onChange={(e) => setPhase(e.target.value)}
      >
        <option value="inspection">Inspection</option>
        <option value="execution">Execution</option>
      </select>
      {reserved.length > 0 && (
        <p className={styles.muted}>
          {reserved.length} worker(s) already offered or assigned to {phase}.
        </p>
      )}
      {workers.map((row, index) => (
        <fieldset key={row.key} className={styles.card} disabled={busy}>
          <legend>Worker {index + 1}</legend>
          <label htmlFor={`${id}-worker-${row.key}`}>Worker {index + 1}</label>
          <select
            id={`${id}-worker-${row.key}`}
            required
            value={row.providerId}
            onChange={(e) => update(row.key, { providerId: e.target.value })}
          >
            <option value="">Select a worker</option>
            {providers.map((p) => (
              <option
                key={p.id}
                value={p.id}
                disabled={
                  reserved.some((a) => a.provider_id === p.id) ||
                  workers.some(
                    (w) => w.key !== row.key && w.providerId === p.id,
                  )
                }
              >
                {p.label}
                {reserved.some((a) => a.provider_id === p.id)
                  ? " — already on this phase"
                  : ""}
              </option>
            ))}
          </select>
          <label htmlFor={`${id}-trade-${row.key}`}>
            Role / trade for worker {index + 1}
          </label>
          <input
            id={`${id}-trade-${row.key}`}
            value={row.trade}
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Lead plumber"
            onChange={(e) => update(row.key, { trade: e.target.value })}
          />
          {workers.length > 1 && (
            <Button
              type="button"
              onClick={() =>
                setWorkers((rows) => rows.filter((w) => w.key !== row.key))
              }
            >
              Remove worker {index + 1}
            </Button>
          )}
        </fieldset>
      ))}
      <Button
        type="button"
        disabled={busy || workers.length >= 50}
        onClick={() =>
          setWorkers((rows) => [
            ...rows,
            { key: next.current++, providerId: "", trade: "" },
          ])
        }
      >
        Add another worker
      </Button>
      <label htmlFor={`${id}-expiry`}>
        Offer deadline (24–48 hours from now)
      </label>
      <input
        name="expiry"
        id={`${id}-expiry`}
        type="datetime-local"
        value={expiry}
        min={expiryBounds.min || undefined}
        max={expiryBounds.max || undefined}
        onFocus={refreshExpiryBounds}
        onChange={(event) => setExpiry(event.target.value)}
        aria-describedby={`${id}-expiry-help`}
        required
        disabled={busy}
      />
      <Button
        type="button"
        disabled={busy}
        onClick={() => {
          const now = refreshExpiryBounds();
          setExpiry(manilaInput(now + 36 * HOUR));
          setMessage(null);
        }}
      >
        Use recommended deadline (36 hours)
      </Button>
      <small id={`${id}-expiry-help`} className={styles.muted}>
        Workers have 24–48 hours to respond. The deadline must come before work
        starts.
      </small>
      <label htmlFor={`${id}-buffer`}>Travel buffer per worker (minutes)</label>
      <input
        name="buffer"
        id={`${id}-buffer`}
        type="number"
        min={0}
        max={240}
        value={buffer}
        onChange={(event) => setBuffer(Number(event.target.value))}
        required
        disabled={busy}
      />
      <AvailableSchedulePicker
        bookingId={booking}
        providerIds={workers.map((w) => w.providerId)}
        expiry={expiry}
        buffer={buffer}
        disabled={busy}
      />
      <p className={styles.muted}>
        All times are Philippine time. Use a separate batch for a different work
        period.
      </p>
      {message && <p role="status">{message}</p>}
      <Button
        type="submit"
        disabled={busy || !providers.length || !booking}
        loading={busy}
      >
        Send assignment offers to {workers.length} worker
        {workers.length === 1 ? "" : "s"}
      </Button>
    </form>
  );
}
