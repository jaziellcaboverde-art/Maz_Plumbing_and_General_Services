"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/matching/client";
import styles from "./workspace.module.css";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function WeeklyHoursForm({
  initial,
}: {
  initial: { weekday: number; starts_at: string; ends_at: string }[];
}) {
  const router = useRouter();
  const [days, setDays] = useState(
    DAYS.map((name, weekday) => {
      const saved = initial.find((h) => h.weekday === weekday);
      return {
        name,
        weekday,
        enabled: !!saved,
        start: saved?.starts_at.slice(0, 5) ?? "08:00",
        end: saved?.ends_at.slice(0, 5) ?? "17:00",
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className={styles.form}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setMessage(null);
        const error = await postJson("/api/provider/weekly-hours", {
          hours: days
            .filter((d) => d.enabled)
            .map(({ weekday, start, end }) => ({ weekday, start, end })),
        });
        setMessage(
          error ?? "Working hours saved. Existing assignments stay scheduled.",
        );
        setBusy(false);
        if (!error) router.refresh();
      }}
    >
      <h2>Weekly working hours</h2>
      <p className={styles.muted}>
        Select your regular working days. Add leave under dated exceptions.
      </p>
      {days.map((day, index) => (
        <div className={styles.dayRow} key={day.weekday}>
          <label>
            <input
              type="checkbox"
              checked={day.enabled}
              disabled={busy}
              onChange={(e) =>
                setDays((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, enabled: e.target.checked } : r,
                  ),
                )
              }
            />{" "}
            {day.name}
          </label>
          <div className={styles.timeRange}>
            <input
              aria-label={`${day.name} starts`}
              type="time"
              required={day.enabled}
              disabled={!day.enabled || busy}
              value={day.start}
              onChange={(e) =>
                setDays((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, start: e.target.value } : r,
                  ),
                )
              }
            />
            <span>to</span>
            <input
              aria-label={`${day.name} ends`}
              type="time"
              required={day.enabled}
              disabled={!day.enabled || busy}
              value={day.end}
              onChange={(e) =>
                setDays((rows) =>
                  rows.map((r, i) =>
                    i === index ? { ...r, end: e.target.value } : r,
                  ),
                )
              }
            />
          </div>
        </div>
      ))}
      {message && <p role="status">{message}</p>}
      <Button type="submit" variant="primary" loading={busy} disabled={busy}>
        Save weekly hours
      </Button>
    </form>
  );
}
