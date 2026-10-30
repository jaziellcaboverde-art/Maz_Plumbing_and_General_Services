"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, Search } from "lucide-react";
import styles from "./audit-log-screen.module.css";
import iconSize from "@/components/ui/icon-size.module.css";

export type AuditEvent = {
  id: string;
  actor: string;
  actorId: string | null;
  action: string;
  target: string;
  targetTable: string | null;
  targetId: string | null;
  reason: string | null;
  details: unknown;
  createdAt: string;
};

type Filter = "all" | "bookings" | "providers" | "system";

function category(action: string): Exclude<Filter, "all"> {
  const value = action.toLowerCase();
  if (value.startsWith("booking.")) return "bookings";
  if (value.startsWith("provider") || value.startsWith("provider_application.")) return "providers";
  return "system";
}

function eventLabel(action: string) {
  const labels: Record<string, string> = {
    "booking.status": "Booking status updated",
    "arrival_override.review": "Arrival override reviewed",
    "config.change": "Configuration changed",
    "provider_application.submit": "Provider application submitted",
    "provider_application.approved": "Provider application approved",
    "provider_application.rejected": "Provider application rejected",
    "provider_application.expired_documents_deleted": "Expired applicant documents deleted",
    "provider.payout.update": "Provider payout details updated",
    "provider.resigned": "Provider resigned",
    "service.create": "Service created",
    "service.update": "Service updated",
  };
  return labels[action] ?? readable(action);
}

function readable(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function localDate(value: string) {
  const date = new Date(value);
  return {
    time: new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(date),
    date: new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", weekday: "short", day: "2-digit", month: "short" }).format(date),
  };
}

function csvCell(value: unknown) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function AuditLogScreen({ events, loadError }: { events: AuditEvent[]; loadError: string | null }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("7");
  const [expanded, setExpanded] = useState<string | null>(null);
  // Read the clock once when the screen opens so the period filter stays stable between renders.
  const [openedAt] = useState(() => Date.now());

  const visibleEvents = useMemo(() => {
    const since = period === "all" ? 0 : openedAt - Number(period) * 24 * 60 * 60 * 1000;
    const query = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesFilter = filter === "all" || category(event.action) === filter;
      const matchesSearch = !query || [event.actor, event.action, event.target, event.reason ?? "", JSON.stringify(event.details ?? "")].join(" ").toLowerCase().includes(query);
      return matchesFilter && matchesSearch && new Date(event.createdAt).getTime() >= since;
    });
  }, [events, filter, openedAt, period, search]);

  function exportCsv() {
    const header = ["When (UTC)", "Actor", "Actor ID", "Event", "Target", "Reason", "Details"];
    const lines = [header, ...visibleEvents.map((event) => [event.createdAt, event.actor, event.actorId ?? "", event.action, event.target, event.reason ?? "", event.details])];
    const blob = new Blob([`\uFEFF${lines.map((line) => line.map(csvCell).join(",")).join("\r\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All events" }, { id: "bookings", label: "Bookings" }, { id: "providers", label: "Provider activity" }, { id: "system", label: "System changes" },
  ];

  return <main className={styles.page}>
    <div className={styles.heading}>
      <div><h1>Audit log</h1><p>Every change in MAZ, kept for 90 days.</p></div>
      <button className={styles.exportButton} type="button" onClick={exportCsv}><Download className={iconSize.sm} aria-hidden="true" />Export CSV</button>
    </div>

    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label="Filter audit events">
        {filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} className={filter === item.id ? styles.activeTab : ""} type="button" onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      <label className={styles.search}><Search className={iconSize.sm} aria-hidden="true" /><span className={styles.visuallyHidden}>Search actor or target</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search actor or target" /></label>
      <label className={styles.period}><CalendarDays className={iconSize.sm} aria-hidden="true" /><span className={styles.visuallyHidden}>Date range</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="all">All retained</option></select><ChevronDown className={iconSize.sm} aria-hidden="true" /></label>
    </div>

    {loadError && <p className={styles.error} role="alert">Could not load audit records: {loadError}</p>}
    <section className={styles.tableCard} aria-label="Audit events">
      <div className={`${styles.row} ${styles.tableHeader}`}><span>When</span><span>Actor</span><span>Event</span><span>Target</span><span aria-hidden="true" /></div>
      {visibleEvents.map((event) => {
        const date = localDate(event.createdAt);
        const kind = category(event.action);
        const open = expanded === event.id;
        return <div className={styles.eventGroup} key={event.id}>
          <div className={`${styles.row} ${styles.eventRow}`}>
            <div className={styles.when}><strong>{date.time}</strong><span>{date.date}</span></div>
            <div className={styles.actor}><span className={styles.avatar}>{initials(event.actor)}</span><strong>{event.actor}</strong></div>
            <div className={styles.event}><span className={`${styles.badge} ${styles[kind]}`}>{kind === "bookings" ? "Booking" : kind === "providers" ? "Provider" : "System"}</span><span>{eventLabel(event.action)}</span></div>
            <span className={styles.target}>{event.target}</span>
            <button className={styles.expand} type="button" aria-label={`${open ? "Collapse" : "Expand"} details for ${readable(event.action)}`} aria-expanded={open} onClick={() => setExpanded(open ? null : event.id)}>{open ? <ChevronUp className={iconSize.sm} /> : <ChevronDown className={iconSize.sm} />}</button>
          </div>
          {open && <div className={styles.details}>
            <dl><dt>Actor ID</dt><dd>{event.actorId ?? "System"}</dd><dt>Target table</dt><dd>{event.targetTable ?? "—"}</dd><dt>Target ID</dt><dd>{event.targetId ?? "—"}</dd>{event.reason && <><dt>Reason</dt><dd>{event.reason}</dd></>}</dl>
            <pre>{JSON.stringify(event.details ?? {}, null, 2)}</pre>
          </div>}
        </div>;
      })}
      {visibleEvents.length === 0 && <p className={styles.empty}>No audit events match these filters.</p>}
    </section>
  </main>;
}
