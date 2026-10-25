"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDay } from "./schedule-dates";
import styles from "./schedule-board.module.css";

const DAILY_CAPACITY = 8;
const WINDOW_CAPACITY = DAILY_CAPACITY * 10;

export type ScheduleBooking = {
  id: string;
  dayKey: string;
  startsAt: string;
  customer: string;
  service: string;
  status: string;
  attention?: string;
};

export type ScheduleProvider = {
  id: string;
  name: string;
  bookings: ScheduleBooking[];
};

type WorkloadRow = ScheduleProvider & { hoursByDay: number[] };

export function ProviderScheduleBoard({ providers, attention, weekStart, dayKeys }: {
  providers: ScheduleProvider[];
  attention: ScheduleBooking[];
  weekStart: string;
  dayKeys: string[];
}) {
  const router = useRouter();
  const [rebalanced, setRebalanced] = useState<string[]>([]);
  const rows = useMemo<WorkloadRow[]>(() => providers.map((provider) => ({
    ...provider,
    hoursByDay: dayKeys.map((day) => provider.bookings.filter((booking) => booking.dayKey === day).length * 2),
  })), [providers, dayKeys]);
  const totals = rows.map((row) => row.hoursByDay.reduce((sum, hours) => sum + hours, 0));
  const bookedHours = totals.reduce((sum, hours) => sum + hours, 0);
  const teamCapacity = rows.length * WINDOW_CAPACITY;
  const highestBookedHours = Math.max(...totals);
  const overbookedIndex = highestBookedHours > WINDOW_CAPACITY ? totals.indexOf(highestBookedHours) : -1;
  const availableIndex = totals.reduce((best, hours, index) => hours < totals[best] ? index : best, 0);
  const overbookedHours = overbookedIndex < 0 ? 0 : totals[overbookedIndex] - WINDOW_CAPACITY;
  const freeHours = rows.length && availableIndex >= 0 ? Math.max(0, WINDOW_CAPACITY - totals[availableIndex]) : 0;
  const transferHours = Math.min(overbookedHours, freeHours);
  const pairKey = overbookedIndex < 0 ? "" : `${rows[overbookedIndex].id}:${rows[availableIndex]?.id ?? ""}`;
  const alreadyRebalanced = Boolean(pairKey && rebalanced.includes(pairKey));
  const labelStart = dayKeys[0] ?? weekStart;
  const labelEnd = dayKeys[9] ?? addDays(weekStart, 11);
  const weekLabel = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric" }).formatRange(
    new Date(`${labelStart}T00:00:00Z`), new Date(`${labelEnd}T00:00:00Z`),
  );

  function shiftWeek(offset: number) {
    router.push(`/admin/provider-schedules?week=${addDays(weekStart, offset * 7)}`);
  }

  function rebalanceHours() {
    if (overbookedIndex < 0 || availableIndex < 0 || overbookedIndex === availableIndex || transferHours <= 0) return;
    const donor = rows[overbookedIndex];
    const receiver = rows[availableIndex];
    let remaining = transferHours;
    for (let day = 0; day < dayKeys.length && remaining > 0; day += 1) {
      const move = Math.min(remaining, Math.max(0, donor.hoursByDay[day] - DAILY_CAPACITY), Math.max(0, DAILY_CAPACITY - receiver.hoursByDay[day]));
      donor.hoursByDay[day] -= move;
      receiver.hoursByDay[day] += move;
      remaining -= move;
    }
    for (let day = 0; day < dayKeys.length && remaining > 0; day += 1) {
      const move = Math.min(remaining, Math.max(0, donor.hoursByDay[day] - 4), Math.max(0, 10 - receiver.hoursByDay[day]));
      donor.hoursByDay[day] -= move;
      receiver.hoursByDay[day] += move;
      remaining -= move;
    }
    setRebalanced((current) => [...current, pairKey]);
  }

  return <div className={styles.layout}>
    <main className={styles.main}>
      <header className={styles.header}>
        <div><h1>Provider schedules</h1></div>
        <div className={styles.stepper} aria-label="Schedule date range">
          <button type="button" className={styles.stepButton} aria-label="Previous two-week window" onClick={() => shiftWeek(-1)}><ChevronLeft aria-hidden="true" /></button>
          <span>{weekLabel}</span>
          <button type="button" className={styles.stepButton} aria-label="Next two-week window" onClick={() => shiftWeek(1)}><ChevronRight aria-hidden="true" /></button>
        </div>
      </header>

      <section className={styles.summary} aria-label="Team workload summary">
        <SummaryCard label="Team capacity" value={`${teamCapacity}h`} />
        <SummaryCard label="Booked" value={`${formatHours(bookedHours)}h`} />
        <SummaryCard label="Utilization" value={`${teamCapacity ? Math.round(bookedHours / teamCapacity * 100) : 0}%`} />
      </section>

      <section className={styles.tableCard} aria-label="Provider workload by day">
        <div className={styles.tableScroll}>
          <div className={styles.table} role="table" aria-label="Provider booked hours and daily workload">
            <div className={`${styles.row} ${styles.columnHead}`} role="row">
              <span role="columnheader">Person</span>
              <span role="columnheader">Booked vs capacity</span>
              <div className={styles.heatHeader} role="columnheader" aria-label="Daily hours, two working weeks">
                {dayKeys.map((day, index) => <span className={index === 5 ? styles.newWeek : ""} key={day} aria-label={formatDay(day)}>{formatDay(day).slice(0, 1)}</span>)}
              </div>
            </div>
            <div key={weekStart} className={styles.rows} role="rowgroup">
              {rows.map((row, index) => <WorkloadRowView key={row.id} row={row} total={row.hoursByDay.reduce((sum, hours) => sum + hours, 0)} dayKeys={dayKeys} index={index} />)}
              {!rows.length && <p className={styles.empty}>No approved providers are available.</p>}
            </div>
          </div>
        </div>
        <p className={styles.estimateNote}>Planning estimate: each scheduled project counts as 2 hours; provider capacity is 8 hours per working day.</p>
      </section>
    </main>

    <aside className={styles.drawer} aria-label="Provider schedule insights">
      <section>
        <p className={styles.sectionLabel}>Needs attention</p>
        {overbookedIndex >= 0 ? <div className={styles.suggestion}>
          <div className={styles.suggestionTop}>
            <span className={styles.alertIcon}><AlertTriangle size={17} aria-hidden="true" /></span>
            <div><strong>{rows[overbookedIndex].name} is overbooked</strong><small>{formatHours(totals[overbookedIndex])}h booked, {formatHours(overbookedHours)}h over capacity</small></div>
          </div>
          {transferHours > 0 ? <p>Move {formatHours(transferHours)}h of scheduled work to <b>{rows[availableIndex].name}</b>, who has {formatHours(freeHours)}h free.</p> : <p>No provider has free hours to take this scheduled work.</p>}
          <button type="button" className={`${styles.rebalanceButton} ${alreadyRebalanced ? styles.rebalanced : ""}`} onClick={rebalanceHours} disabled={alreadyRebalanced || transferHours <= 0}>
            {alreadyRebalanced ? <><Check size={16} aria-hidden="true" /> Rebalanced</> : transferHours > 0 ? `Rebalance ${formatHours(transferHours)}h` : "No capacity available"}
          </button>
        </div> : <div className={`${styles.suggestion} ${styles.allClear}`}>
          <div className={styles.suggestionTop}><span className={styles.clearIcon}><Check size={17} aria-hidden="true" /></span><div><strong>Everyone is within capacity</strong><small>No provider is over {WINDOW_CAPACITY}h in this window</small></div></div>
          {rebalanced.length > 0 && <button type="button" className={`${styles.rebalanceButton} ${styles.rebalanced}`} disabled><Check size={16} aria-hidden="true" /> Rebalanced</button>}
        </div>}
        {attention.length > 0 && <div className={styles.unassigned}>
          <strong>Projects needing assignment</strong>
          <ul>{attention.slice(0, 4).map((booking) => <li key={booking.id}>{booking.service}: {booking.customer}</li>)}</ul>
        </div>}
      </section>

      <section className={styles.available}>
        <p className={styles.sectionLabel}>Most available</p>
        {rows.length ? <ul>{[...rows].sort((a, b) => (WINDOW_CAPACITY - a.hoursByDay.reduce((sum, hours) => sum + hours, 0)) - (WINDOW_CAPACITY - b.hoursByDay.reduce((sum, hours) => sum + hours, 0))).reverse().slice(0, 4).map((row) => {
          const hours = row.hoursByDay.reduce((sum, value) => sum + value, 0);
          return <li key={row.id}><span className={styles.avatar} data-list-avatar="true">{initials(row.name)}</span><span className={styles.availableName}><b>{row.name}</b><small>Provider</small></span><em>{formatHours(Math.max(0, WINDOW_CAPACITY - hours))}h free</em></li>;
        })}</ul> : <p className={styles.drawerEmpty}>No approved providers.</p>}
      </section>
    </aside>
  </div>;
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return <article className={styles.summaryCard}><span>{label}</span><strong>{value}</strong></article>;
}

function WorkloadRowView({ row, total, dayKeys, index }: { row: WorkloadRow; total: number; dayKeys: string[]; index: number }) {
  const over = Math.max(0, total - WINDOW_CAPACITY);
  const standard = Math.min(total, WINDOW_CAPACITY) / (WINDOW_CAPACITY * 1.25);
  const excess = Math.min(over, WINDOW_CAPACITY * 0.25) / (WINDOW_CAPACITY * 0.25);
  return <div className={styles.providerRow} role="row" style={{ "--row-index": index } as CSSProperties}>
    <div className={styles.identity} role="rowheader"><span className={styles.avatar} data-list-avatar="true">{initials(row.name)}</span><span><b>{row.name}</b><small>Provider</small></span></div>
    <div className={styles.capacity} role="cell">
      <div className={styles.track} role="img" aria-label={`${formatHours(total)} of ${WINDOW_CAPACITY} hours capacity${over ? `, ${formatHours(over)} hours over` : ""}`}>
        <span className={styles.filled} style={{ transform: `scaleX(${standard})` }} />
        <span className={styles.overFill} style={{ transform: `scaleX(${excess})` }} />
        <span className={styles.capacityMarker} />
      </div>
      <span className={`${styles.hoursText} ${over ? styles.overText : ""}`}><b>{formatHours(total)}h</b> of {WINDOW_CAPACITY}h{over > 0 && <> <strong>(+{formatHours(over)}h)</strong></>}</span>
    </div>
    <div className={styles.heatCells} role="cell" aria-label={`${row.name} hours by working day`}>
      {row.hoursByDay.map((hours, day) => <span className={`${hours > DAILY_CAPACITY ? styles.overCell : ""} ${day === 5 ? styles.newWeek : ""}`} key={dayKeys[day]} title={`${formatDay(dayKeys[day])}: ${formatHours(hours)} hours`} aria-label={`${formatDay(dayKeys[day])}: ${formatHours(hours)} hours`} style={{ backgroundColor: hours > DAILY_CAPACITY ? `rgba(255,159,10,${Math.min(0.78, 0.34 + (hours - DAILY_CAPACITY) * 0.08)})` : `rgba(10,108,255,${Math.min(0.72, 0.05 + hours / DAILY_CAPACITY * 0.62)})` }}>{formatHours(hours)}</span>)}
    </div>
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
