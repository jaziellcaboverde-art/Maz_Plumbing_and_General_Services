"use client";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { dayAndTime } from "@/lib/matching/format";
import { manilaInputToISO } from "@/lib/provider/time";
import styles from "./workspace.module.css";

type Slot = { starts_at: string; ends_at: string };
type Result = { key: string; slots: Slot[]; error?: string };
const DAY = 86400000;
function localDate(iso: string) {
  return new Date(Date.parse(iso) + 8 * 3600000).toISOString().slice(0, 10);
}

export function AvailableSchedulePicker({
  bookingId,
  providerIds,
  expiry,
  buffer,
  disabled = false,
}: {
  bookingId: string;
  providerIds: string[];
  expiry: string;
  buffer: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [duration, setDuration] = useState(60);
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [day, setDay] = useState("");
  const [selected, setSelected] = useState("");
  const after = manilaInputToISO(expiry);
  const ready =
    !!bookingId &&
    providerIds.length > 0 &&
    providerIds.every(Boolean) &&
    !!after;
  const from = after
    ? localDate(new Date(Date.parse(after) + offset * DAY).toISOString())
    : "";
  const payload = JSON.stringify({
    providerIds: [...new Set(providerIds)].sort(),
    from,
    after,
    duration,
    buffer,
  });
  const key = ready ? `${bookingId}:${revision}:${payload}` : "";
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/bookings/${bookingId}/available-slots`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            signal: controller.signal,
          },
        );
        const body = await response.json();
        if (!controller.signal.aborted)
          setResult({
            key,
            slots: response.ok ? body.slots : [],
            error: response.ok
              ? undefined
              : (body.error ?? "Could not load schedules."),
          });
      } catch {
        if (!controller.signal.aborted)
          setResult({
            key,
            slots: [],
            error: "Could not load schedules. Please retry.",
          });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, bookingId, payload]);
  const current = result?.key === key && !!key ? result : null;
  const slots = current?.slots ?? [];
  const days = [...new Set(slots.map((s) => localDate(s.starts_at)))];
  const activeDay = days.includes(day) ? day : (days[0] ?? "");
  const options = slots.filter((s) => localDate(s.starts_at) === activeDay);
  const slot = options.find((s) => s.starts_at === selected);
  return (
    <fieldset className={styles.schedulePicker} disabled={disabled}>
      <legend>Available work schedule</legend>
      <label htmlFor={`${id}-duration`}>Work duration</label>
      <select
        id={`${id}-duration`}
        value={duration}
        onChange={(e) => {
          setDuration(Number(e.target.value));
          setSelected("");
        }}
      >
        {[30, 60, 120, 180, 240, 360, 480].map((n) => (
          <option key={n} value={n}>
            {n < 60 ? "30 minutes" : `${n / 60} hour${n === 60 ? "" : "s"}`}
          </option>
        ))}
      </select>
      {!ready ? (
        <p>Select all workers and set the offer deadline first.</p>
      ) : (
        <>
          <div className={styles.actions}>
            <Button
              disabled={disabled || offset === 0}
              onClick={() => {
                setOffset((n) => Math.max(0, n - 14));
                setSelected("");
              }}
            >
              Previous 14 days
            </Button>
            <Button
              disabled={disabled || offset >= 350}
              onClick={() => {
                setOffset((n) => n + 14);
                setSelected("");
              }}
            >
              Next 14 days
            </Button>
            <Button
              disabled={disabled}
              onClick={() => setRevision((n) => n + 1)}
            >
              Refresh schedules
            </Button>
          </div>
          <p className={styles.muted}>
            From {from}, Philippine time.{" "}
            {providerIds.length > 1
              ? "Only times available to every selected worker are shown."
              : "Only this worker’s available times are shown."}
          </p>
          {!current ? (
            <p role="status">Loading available schedules…</p>
          ) : current.error ? (
            <p role="alert">{current.error}</p>
          ) : !slots.length ? (
            <p role="status">
              No available schedule in these 14 days. Try another duration or
              date range, or ask the worker to update their availability.
            </p>
          ) : (
            <>
              <label htmlFor={`${id}-day`}>Available date</label>
              <select
                id={`${id}-day`}
                value={activeDay}
                onChange={(e) => {
                  setDay(e.target.value);
                  setSelected("");
                }}
              >
                {days.map((d) => (
                  <option key={d} value={d}>
                    {new Intl.DateTimeFormat("en-PH", {
                      dateStyle: "full",
                      timeZone: "Asia/Manila",
                    }).format(new Date(`${d}T00:00:00+08:00`))}
                  </option>
                ))}
              </select>
              <label htmlFor={`${id}-time`}>Available time</label>
              <select
                id={`${id}-time`}
                required
                value={slot?.starts_at ?? ""}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select an available time</option>
                {options.map((s) => (
                  <option key={s.starts_at} value={s.starts_at}>
                    {dayAndTime(s.starts_at)} –{" "}
                    {new Intl.DateTimeFormat("en-PH", {
                      timeStyle: "short",
                      timeZone: "Asia/Manila",
                    }).format(new Date(s.ends_at))}
                  </option>
                ))}
              </select>
            </>
          )}
        </>
      )}
      <input type="hidden" name="start" value={slot ? slot.starts_at : ""} />
      <input type="hidden" name="end" value={slot ? slot.ends_at : ""} />
    </fieldset>
  );
}
