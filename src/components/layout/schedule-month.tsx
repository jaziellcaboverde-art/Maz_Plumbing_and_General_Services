"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./schedule-month.module.css";

type Event = { id: string; start: string; label: string; href: string };

/** Dates are anchored to the server request, avoiding a clock read during rendering. */
export function ScheduleMonth({
  today,
  events,
}: {
  today: string;
  events: Event[];
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const length = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const title = first.toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  function move(delta: number) {
    setMonth(
      new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
        .toISOString()
        .slice(0, 7),
    );
  }
  return (
    <section className={styles.calendar} aria-label="Assignment calendar">
      <div className={styles.heading}>
        <h2 aria-live="polite">{title}</h2>
        <div className={styles.controls}>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => move(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setMonth(today.slice(0, 7))}>
            This month
          </button>
          <button type="button" aria-label="Next month" onClick={() => move(1)}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className={styles.grid}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div className={styles.weekday} key={day}>
            {day}
          </div>
        ))}
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <div className={styles.blank} key={`blank-${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`;
          const matches = events.filter(
            (event) =>
              new Date(event.start).toLocaleDateString("en-CA", {
                timeZone: "Asia/Manila",
              }) === key,
          );
          return (
            <div
              className={styles.day}
              key={key}
              data-today={key === today || undefined}
            >
              <time
                dateTime={key}
                aria-current={key === today ? "date" : undefined}
              >
                {i + 1}
              </time>
              {matches.map((event) => (
                <Link key={event.id} href={event.href} className={styles.event}>
                  {event.label}
                  <small>
                    {new Date(event.start).toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: "Asia/Manila",
                    })}
                  </small>
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <p className={styles.note}>
        Philippine time. Offer holds remain tentative until accepted and
        confirmed by MAZ.
      </p>
    </section>
  );
}
