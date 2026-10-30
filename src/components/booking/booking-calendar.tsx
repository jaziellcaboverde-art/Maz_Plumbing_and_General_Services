import type { ReactNode } from "react";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/booking/rules";
import {
  GROUP_LABELS, groupOf, hourLabel, hours, placeBookings, relativeDay, timeText, weekDays, weekTitle, addDays,
  type CalendarBooking, type StatusGroup,
} from "@/lib/booking/calendar";
import styles from "./booking-calendar.module.css";

const GROUPS: StatusGroup[] = ["finding", "confirmed", "done", "cancelled"];

function hrefFor(booking: CalendarBooking): string {
  if (booking.href) return booking.href;
  return booking.status === "draft" ? `/customer/bookings/new?draft=${booking.id}` : `/customer/bookings/${booking.id}`;
}

function Chip({ booking }: { booking: CalendarBooking }) {
  return (
    <Link className={styles.chip} data-group={groupOf(booking.status)} href={hrefFor(booking)}>
      <span className={styles.chipTitle}>{booking.serviceName}</span>
      {booking.subtitle && <span className={styles.chipMeta}>{booking.subtitle}</span>}
      <span className={styles.chipMeta}>{booking.start ? timeText(booking.start) : ""} · {STATUS_LABELS[booking.status]}</span>
    </Link>
  );
}

/** A week calendar of the customer's bookings, with a side column: counts, what is next, what needs a time. */
export function BookingCalendar({ bookings, monday, todayKey, nowIso, basePath = "/customer/bookings", extraParams = "", sideTop, sideTitle = "Your bookings", noTimeTitle = "No time set yet" }: {
  bookings: CalendarBooking[]; monday: string; todayKey: string; nowIso: string;
  /** The page the week arrows link back to. */
  basePath?: string;
  /** Other query parameters to keep when changing week, such as `&provider=...`. */
  extraParams?: string;
  /** Replaces the "Book a service" card, for example with a provider filter. */
  sideTop?: ReactNode;
  sideTitle?: string;
  noTimeTitle?: string;
}) {
  const days = weekDays(monday);
  const cells = placeBookings(bookings, days);
  const counts = Object.fromEntries(GROUPS.map((g) => [g, bookings.filter((b) => groupOf(b.status) === g).length])) as Record<StatusGroup, number>;
  const upNext = bookings
    .filter((b) => groupOf(b.status) === "confirmed" && b.start && b.start >= nowIso)
    .sort((a, b) => String(a.start).localeCompare(String(b.start)))
    .slice(0, 3);
  const needsTime = bookings.filter((b) => groupOf(b.status) !== "done" && groupOf(b.status) !== "cancelled" && (!b.start || b.status === "draft"));
  const weekHasBookings = days.some((d) => [...cells.keys()].some((k) => k.startsWith(`${d.key}|`)));
  const todayInWeek = days.find((d) => d.key === todayKey);

  return (
    <div className={styles.layout}>
      <aside className={styles.side} aria-label="Booking summary">
        {sideTop ?? (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{sideTitle}</h2>
            <Link className={styles.primaryLink} href="/customer/bookings/new">Book a service</Link>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Status</h2>
          <ul className={styles.legend}>
            {GROUPS.map((g) => (
              <li key={g} className={styles.legendRow}>
                <span className={styles.swatch} data-group={g} aria-hidden="true" />
                <span>{GROUP_LABELS[g]}</span>
                <span className={styles.count}>{counts[g]}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Up next</h2>
          {upNext.length === 0 && <p className={styles.muted}>Nothing is scheduled yet.</p>}
          <ul className={styles.upNext}>
            {upNext.map((b) => (
              <li key={b.id}>
                <Link className={styles.upNextLink} href={hrefFor(b)}>
                  <span className={styles.chipTitle}>{b.serviceName}</span>
                  <span className={styles.chipMeta}>{timeText(b.start as string)}</span>
                  <span className={styles.relative}>{relativeDay(b.start as string, todayKey)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {needsTime.length > 0 && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{noTimeTitle}</h2>
            <ul className={styles.upNext}>
              {needsTime.map((b) => (
                <li key={b.id}>
                  <Link className={styles.upNextLink} href={hrefFor(b)}>
                    <span className={styles.chipTitle}>{b.serviceName}</span>
                    <span className={styles.chipMeta}>{b.status === "draft" ? "Draft. Continue it" : b.isUrgent ? "Urgent" : STATUS_LABELS[b.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>

      <section className={styles.main} aria-label="Week calendar">
        <header className={styles.weekHead}>
          <div>
            <h2 className={styles.weekTitle}>{weekTitle(monday)}</h2>
            <p className={styles.muted}>Philippine time{todayInWeek ? `, ${todayInWeek.weekday} is today` : ""}</p>
          </div>
          <nav className={styles.weekNav} aria-label="Change week">
            <Link className={styles.navLink} href={`${basePath}?week=${addDays(monday, -7)}${extraParams}`} aria-label="Previous week">‹</Link>
            <Link className={styles.navLink} href={extraParams ? `${basePath}?${extraParams.slice(1)}` : basePath}>Today</Link>
            <Link className={styles.navLink} href={`${basePath}?week=${addDays(monday, 7)}${extraParams}`} aria-label="Next week">›</Link>
          </nav>
        </header>

        {/* Wide screens: the hour grid. */}
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <caption className={styles.srOnly}>Your bookings for {weekTitle(monday)}</caption>
            <thead>
              <tr>
                <td className={styles.corner} />
                {days.map((d) => (
                  <th key={d.key} scope="col" className={styles.dayHead} data-today={d.key === todayKey || undefined}>
                    <span className={styles.weekday}>{d.weekday}</span>
                    <span className={styles.dayNumber}>{d.day}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {hours().map((h) => (
                <tr key={h}>
                  <th scope="row" className={styles.hourHead}>{hourLabel(h)}</th>
                  {days.map((d) => (
                    <td key={d.key} className={styles.cell} data-today={d.key === todayKey || undefined}>
                      {(cells.get(`${d.key}|${h}`) ?? []).map((b) => <Chip key={b.id} booking={b} />)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phones: a plain list by day, because an hour grid is too tight. */}
        <ol className={styles.agenda}>
          {days.map((d) => {
            const items = bookings.filter((b) => b.start && placeBookings([b], [d]).size > 0)
              .sort((a, b) => String(a.start).localeCompare(String(b.start)));
            if (items.length === 0) return null;
            return (
              <li key={d.key} className={styles.agendaDay}>
                <h3 className={styles.agendaTitle}>{d.weekday} {d.day}{d.key === todayKey ? " (today)" : ""}</h3>
                <ul className={styles.upNext}>{items.map((b) => <li key={b.id}><Chip booking={b} /></li>)}</ul>
              </li>
            );
          })}
        </ol>
        {!weekHasBookings && <p className={styles.muted}>No bookings this week. Use the arrows to look at another week.</p>}
      </section>
    </div>
  );
}
