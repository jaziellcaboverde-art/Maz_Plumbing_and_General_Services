"use client";
import { ActionLink } from "@/components/ui/action-link";

import { useId, useRef, useState } from "react";
import { useInsideModal } from "@/components/ui/modal";
import layout from "./team-offer-form.module.css";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import type { TeamAssignment } from "@/lib/provider/team";
import { defaultWorkerTrade } from "@/lib/provider/team";
import { useProviderRecommendations } from "@/components/matching/use-provider-recommendations";
import { ProviderRecommendationPicker } from "@/components/matching/provider-recommendation-picker";
import styles from "./workspace.module.css";
type WorkerRow = { key: number; providerId: string; trade: string };
export function TeamOfferForm({
  bookings,
  providers,
  serviceLabel = "this booking's service",
  existingAssignments = [],
  initialPhase = "inspection",
}: {
  bookings: {
    id: string;
    label: string;
    category?: string;
    isRenovation?: boolean;
  }[];
  providers: { id: string; label: string }[];
  serviceLabel?: string;
  existingAssignments?: TeamAssignment[];
  initialPhase?: string;
}) {
  const insideModal = useInsideModal();
  const router = useRouter(),
    id = useId();
  const [booking, setBooking] = useState(
    bookings.length === 1 ? bookings[0].id : "",
  );
  const [phase, setPhase] = useState(initialPhase);
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
      ["accepted", "withdrawal_requested"].includes(a.status),
  );
  const selectedBooking = bookings.find((item) => item.id === booking);
  const trade = defaultWorkerTrade(
    selectedBooking?.category,
    selectedBooking?.isRenovation,
  );
  const excluded = [
    ...new Set([
      ...reserved.map((a) => a.provider_id),
      ...workers.map((w) => w.providerId).filter(Boolean),
    ]),
  ]
    .sort()
    .join(",");
  const recommendations = useProviderRecommendations(booking, excluded);
  const workerIndex = Math.max(
    0,
    workers.findIndex((worker) => !worker.providerId),
  );
  function update(key: number, change: Partial<WorkerRow>) {
    setWorkers((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
  }
  return (
    <form
      className={`${styles.form} ${layout.workspace}`}
      data-modal-layout={insideModal || undefined}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const data = {
          workers: workers.map(({ providerId, trade: workerTrade }) => ({
            providerId,
            trade: (trade ?? workerTrade).trim(),
          })),
          phase,
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
              `${workers.length} worker(s) assigned. No provider acceptance is needed.`,
          );
          if (!error) {
            request.current = null;
            setWorkers([{ key: next.current++, providerId: "", trade: "" }]);
            router.refresh();
          }
        } catch {
          setMessage(
            "Could not confirm the response. Retry the same team or refresh to check existing assignments.",
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
          before assigning workers. The worker list only includes providers
          approved for this booking&apos;s service.
        </p>
      )}
      <p>
        Add qualified workers and their role for {serviceLabel}. Each worker
        will be assigned immediately if available for the booking appointment.
      </p>
      <label htmlFor={`${id}-booking`}>Booking</label>
      <select
        id={`${id}-booking`}
        value={booking}
        required
        disabled={busy}
        onChange={(e) => {
          setBooking(e.target.value);
          setWorkers([{ key: next.current++, providerId: "", trade: "" }]);
          setMessage(null);
        }}
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
          {reserved.length} worker(s) already assigned to {phase}.
        </p>
      )}
      {booking && (
        <ProviderRecommendationPicker
          {...recommendations}
          onRetry={recommendations.refresh}
          providers={providers}
          worker={workerIndex + 1}
          disabled={busy}
          trade={trade}
          onSelect={(providerId) => {
            update(workers[workerIndex].key, { providerId });
            setMessage(`Worker ${workerIndex + 1} selection updated.`);
          }}
        />
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
            value={trade ?? row.trade}
            readOnly={!!trade}
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
      <Button
        disabled={busy}
        onClick={() => {
          setWorkers([{ key: next.current++, providerId: "", trade: "" }]);
          setMessage(null);
        }}
      >
        Cancel changes
      </Button>
      <p className={styles.muted}>
        Uses the customer-approved appointment or the next shared available
        one-hour visit. Availability and conflicts are checked before saving.
      </p>
      {message && <p role="status">{message}</p>}
      <Button
        type="submit"
        disabled={busy || !providers.length || !booking}
        loading={busy}
      >
        Assign {workers.length} worker
        {workers.length === 1 ? "" : "s"}
      </Button>
    </form>
  );
}
