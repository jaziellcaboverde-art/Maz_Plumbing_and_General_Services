"use client";
import { ActionLink } from "@/components/ui/action-link";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useInsideModal } from "@/components/ui/modal";
import { postJson } from "@/lib/matching/client";
import { manilaInputToISO } from "@/lib/provider/time";
import { defaultWorkerTrade, type TeamAssignment } from "@/lib/provider/team";
import { AvailableSchedulePicker } from "./available-schedule-picker";
import { useProviderRecommendations } from "@/components/matching/use-provider-recommendations";
import { ProviderRecommendationPicker } from "@/components/matching/provider-recommendation-picker";
import styles from "./workspace.module.css";
import layout from "./team-offer-form.module.css";
type WorkerRow = { key: number; providerId: string; trade: string };
const HOUR = 60 * 60 * 1000;
function manilaInput(timestamp: number) {
  return new Date(timestamp + 8 * HOUR).toISOString().slice(0, 16);
}
export function TeamOfferForm({
  bookings,
  providers,
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
  existingAssignments?: TeamAssignment[];
  initialPhase?: string;
}) {
  const router = useRouter(),
    id = useId();
  const insideModal = useInsideModal();
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
  const [activeWorker, setActiveWorker] = useState(0);
  const [selectionNotice, setSelectionNotice] = useState("");
  const next = useRef(1),
    request = useRef<{ payload: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const reserved = existingAssignments.filter(
    (a) =>
      a.phase === phase &&
      ["offered", "accepted", "withdrawal_requested"].includes(a.status),
  );
  const selectedBooking = bookings.find((b) => b.id === booking);
  const automatic = !!selectedBooking?.category;
  const automaticRole = defaultWorkerTrade(
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
  const recommendations = useProviderRecommendations(
    automatic ? booking : "",
    excluded,
  );
  const targetWorker =
    workers.find((w) => w.key === activeWorker) ?? workers[0];
  const recommendedIds =
    recommendations.result?.top_three.map((p) => p.provider_id) ?? [];
  const eligibleIds = new Set(
    recommendations.result?.eligible_provider_ids ?? [],
  );
  const selectable = automaticRole
    ? providers.filter(
        (p) =>
          eligibleIds.has(p.id) || workers.some((w) => w.providerId === p.id),
      )
    : providers;
  const rankedProviders = [...selectable].sort((a, b) => {
    const rank = (pid: string) =>
      recommendedIds.includes(pid)
        ? recommendedIds.indexOf(pid)
        : Number.MAX_SAFE_INTEGER;
    return rank(a.id) - rank(b.id);
  });
  function update(key: number, change: Partial<WorkerRow>) {
    setWorkers((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );
    if (change.providerId)
      setSelectionNotice(
        `Worker ${workers.findIndex((row) => row.key === key) + 1} selection updated — review and send offers to confirm.`,
      );
  }
  return (
    <form
      className={`${styles.form} ${layout.workspace}`}
      data-in-modal={insideModal}
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
            trade: (automaticRole ?? trade).trim(),
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
            setSelectionNotice("");
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
      <header className={layout.heading}>
        <div>
          <p className={layout.eyebrow}>Team & schedule</p>
          <h2>Assign service workers</h2>
        </div>
        <span className={layout.badge}>
          {phase === "inspection" ? "Inspection" : "Execution"} phase
        </span>
      </header>
      {!providers.length && (
        <p>
          No approved workers are available yet.{" "}
          <ActionLink href="/admin/provider-applications">
            Review provider applications
          </ActionLink>{" "}
          before sending offers.
        </p>
      )}
      <p>
        {automaticRole
          ? `The worker role is set to ${automaticRole}.`
          : "Add each worker and their role."}{" "}
        Each must accept their offer.
      </p>
      <div className={layout.context}>
        <div className={layout.field}>
          <label htmlFor={`${id}-booking`}>Booking</label>
          <select
            id={`${id}-booking`}
            value={booking}
            required
            disabled={busy}
            onChange={(e) => {
              setBooking(e.target.value);
            setSelectionNotice("");
              const key = next.current++;
              setWorkers([{ key, providerId: "", trade: "" }]);
              setActiveWorker(key);
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
        </div>
        <div className={layout.field}>
          <label htmlFor={`${id}-phase`}>Phase</label>
          <select
            id={`${id}-phase`}
            value={phase}
            disabled={busy}
            onChange={(e) => {
              setPhase(e.target.value);
            setSelectionNotice("");
            setMessage(null);
              const key = next.current++;
              setWorkers([{ key, providerId: "", trade: "" }]);
              setActiveWorker(key);
            }}
          >
            <option value="inspection">Inspection</option>
            <option value="execution">Execution</option>
          </select>
        </div>
      </div>
      {selectionNotice && (
        <p role="status" className={layout.notice}>
          {selectionNotice}
        </p>
      )}
      <div className={layout.columns}>
        <div className={layout.recommendations}>
          {automatic && (
            <ProviderRecommendationPicker
              {...recommendations}
              onRetry={recommendations.refresh}
              providers={providers}
              worker={workers.indexOf(targetWorker) + 1}
              disabled={busy || recommendations.loading}
              trade={automaticRole}
              onSelect={(providerId) =>
                update(targetWorker.key, { providerId })
              }
            />
          )}
          {!automatic && (
            <p className={styles.muted}>
              Choose a booking to see provider recommendations.
            </p>
          )}
        </div>
        <section className={layout.assignments} aria-label="Worker assignment">
          <div className={layout.panelHead}>
            <h3>Worker assignment</h3>
            <span className={layout.badge}>
              {workers.filter((w) => w.providerId).length} selected
            </span>
          </div>
          {reserved.length > 0 && (
            <>
              <p className={styles.muted}>
                {reserved.length} worker(s) already offered or assigned to{" "}
                {phase}.
              </p>
              <ul className={layout.existing} aria-label="Existing assignments">
                {reserved.map((assignment, index) => (
                  <li key={`${assignment.provider_id}-${index}`}>
                    <div className={layout.personHead}>
                      <strong>
                        {providers.find((p) => p.id === assignment.provider_id)
                          ?.label ?? "Assigned worker"}
                      </strong>
                      <span className={layout.badge}>
                        {assignment.status === "offered"
                          ? "Offer pending"
                          : assignment.status === "accepted"
                            ? "Accepted"
                            : "Withdrawal requested"}
                      </span>
                    </div>
                    <span className={layout.subtle}>{assignment.trade}</span>
                    <small>
                      {assignment.status === "offered"
                        ? "Awaiting provider acceptance"
                        : "Existing assignment — manage changes below"}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          {workers.map((row, index) => (
            <fieldset
              key={row.key}
              className={`${styles.card} ${layout.worker}`}
              data-active={row.key === targetWorker.key}
              disabled={busy}
            >
              <legend>Worker {index + 1}</legend>
              {row.providerId && (
                <span className={layout.badge}>Selected · offer not sent</span>
              )}
              <label htmlFor={`${id}-worker-${row.key}`}>
                Worker {index + 1}
              </label>
              <select
                id={`${id}-worker-${row.key}`}
                required
                disabled={
                  !!automaticRole &&
                  (recommendations.loading || !!recommendations.error)
                }
                value={row.providerId}
                onFocus={() => setActiveWorker(row.key)}
                onChange={(e) => {
                  setActiveWorker(row.key);
                  update(row.key, { providerId: e.target.value });
                }}
              >
                <option value="">Select a worker</option>
                {rankedProviders.map((p) => (
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
                    {recommendedIds.includes(p.id)
                      ? ` — Recommended #${recommendedIds.indexOf(p.id) + 1}`
                      : ""}
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
                value={automaticRole ?? row.trade}
                readOnly={!!automaticRole}
                required
                minLength={2}
                maxLength={120}
                placeholder="e.g. Lead plumber"
                onChange={(e) => update(row.key, { trade: e.target.value })}
                onFocus={() => setActiveWorker(row.key)}
              />
              {workers.length > 1 && (
                <Button
                  type="button"
                  onClick={() => {
                    setWorkers((rows) => rows.filter((w) => w.key !== row.key));
                    setSelectionNotice("");
                  }}
                >
                  Remove worker {index + 1}
                </Button>
              )}
            </fieldset>
          ))}
          <Button
            type="button"
            disabled={busy || workers.length >= 50}
            onClick={() => {
              const key = next.current++;
              setActiveWorker(key);
              setWorkers((rows) => [
                ...rows,
                { key, providerId: "", trade: "" },
              ]);
            }}
          >
            Add another worker
          </Button>
        </section>
      </div>
      <section className={layout.schedule} aria-label="Work scheduling">
        <h3>Offer & work schedule</h3>
        <div className={layout.scheduleFields}>
          <div className={layout.field}>
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
              Workers have 24–48 hours to respond. The deadline must come before
              work starts.
            </small>
          </div>
          <div className={layout.field}>
            <label htmlFor={`${id}-buffer`}>
              Travel buffer per worker (minutes)
            </label>
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
          </div>
        </div>
        <AvailableSchedulePicker
          bookingId={booking}
          providerIds={workers.map((w) => w.providerId)}
          expiry={expiry}
          buffer={buffer}
          disabled={busy}
        />
        <p className={styles.muted}>
          All times are Philippine time. Use a separate batch for a different
          work period.
        </p>
      </section>
      {message && <p role="status">{message}</p>}
      <footer className={layout.footer}>
        <div>
          <strong>Assignment summary</strong>
          <p>
            {workers.filter((w) => w.providerId).length} new worker(s) selected
            · {reserved.length} already offered or assigned
          </p>
        </div>
        <div className={layout.footerActions}>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setWorkers([{ key: next.current++, providerId: "", trade: "" }]);
              setSelectionNotice("");
              setMessage(null);
            }}
          >
            Cancel changes
          </Button>
          <Button
            type="submit"
            variant="primary"
            aria-label={`Send assignment offers to ${workers.length} worker${workers.length === 1 ? "" : "s"}`}
            disabled={busy || !providers.length || !booking || workers.some(w => !w.providerId || !(automaticRole ?? w.trade).trim())}
            loading={busy}
          >
            Send offers
          </Button>
        </div>
      </footer>
    </form>
  );
}
