"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, Search } from "lucide-react";
import styles from "./audit-log-screen.module.css";
import iconSize from "@/components/ui/icon-size.module.css";

export type AuditEvent = {
  id: string;
  actor: string;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  target: string;
  targetTable: string | null;
  targetId: string | null;
  reason: string | null;
  details: unknown;
  createdAt: string;
};

const PAGE_SIZE = 10;

type Category = "bookings" | "providers" | "services" | "system";

const CATEGORY_LABELS: Record<Category, string> = { bookings: "Booking", providers: "Provider", services: "Service", system: "System" };

function category(action: string): Category {
  const value = action.toLowerCase();
  if (value.startsWith("booking.")) return "bookings";
  if (value.startsWith("provider")) return "providers";
  if (value.startsWith("service.")) return "services";
  return "system";
}

function eventLabel(action: string) {
  const labels: Record<string, string> = {
    "booking.status": "Booking status updated",
    "arrival_override.review": "Arrival override reviewed",
    "config.change": "Configuration changed",
    "provider_application.submit": "Application submitted",
    "provider_application.approved": "Application approved",
    "provider_application.rejected": "Application rejected",
    "provider_application.expired_documents_deleted": "Expired documents deleted",
    "provider.payout.update": "Payout details updated",
    "provider.resigned": "Provider resigned",
    "service.create": "Service created",
    "service.update": "Service updated",
  };
  const label = labels[action] ?? readable(action);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function readable(value: string) {
  return value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

/** One short line for the Description column: the reason if there is one, else a few of the recorded details. */
function describe(event: AuditEvent) {
  if (event.reason) return event.reason;
  const details = event.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const parts = Object.entries(details as Record<string, unknown>)
      .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
      .slice(0, 3)
      .map(([key, value]) => `${readable(key)}: ${String(value)}`);
    if (parts.length) return parts.join(" · ");
  }
  return event.target === "—" ? "No further details" : event.target;
}

function roleLabel(role: string | null) {
  if (!role) return "Removed";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function whenLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(value));
}

function csvCell(value: unknown) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (/^[\s\u0000-\u001f]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function AuditLogScreen({ events, loadError }: { events: AuditEvent[]; loadError: string | null }) {
  // What the person is typing, and what the Filter button has applied.
  const [searchDraft, setSearchDraft] = useState("");
  const [dayDraft, setDayDraft] = useState("");
  const [applied, setApplied] = useState({ search: "", day: "" });
  const [filter, setFilter] = useState<"all" | Category>("all");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visibleEvents = useMemo(() => {
    const query = applied.search.trim().toLowerCase();
    return events.filter((event) => {
      if (filter !== "all" && category(event.action) !== filter) return false;
      if (applied.day && dayKey(event.createdAt) !== applied.day) return false;
      if (!query) return true;
      return [event.actor, eventLabel(event.action), describe(event), event.target].join(" ").toLowerCase().includes(query);
    });
  }, [applied, events, filter]);

  const pageCount = Math.max(1, Math.ceil(visibleEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const pageEvents = visibleEvents.slice(firstIndex, firstIndex + PAGE_SIZE);

  function applyFilters() {
    setApplied({ search: searchDraft, day: dayDraft });
    setPage(1);
    setExpanded(null);
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(next, 1), pageCount));
    setExpanded(null);
  }

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

  return <main className={styles.page}>
    <div className={styles.heading}>
      <div><h1>Audit log</h1><p>Every change in MAZ, kept for 90 days.</p></div>
      <button className={styles.exportButton} type="button" onClick={exportCsv}><Download className={iconSize.sm} aria-hidden="true" />Export CSV</button>
    </div>

    {loadError && <p className={styles.error} role="alert">Could not load audit records: {loadError}</p>}

    <section className={styles.card} aria-label="Audit events">
      <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
        <label className={styles.search}><Search className={iconSize.sm} aria-hidden="true" /><span className="sr-only">Search by name or description</span><input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by name or description…" /></label>
        <label className={styles.control}><span className="sr-only">Filter by action</span>
          <select value={filter} onChange={(event) => { setFilter(event.target.value as "all" | Category); setPage(1); setExpanded(null); }}>
            <option value="all">All actions</option>
            {(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>)}
          </select>
          <ChevronDown className={iconSize.sm} aria-hidden="true" />
        </label>
        <label className={styles.control}><span className="sr-only">Filter by date</span><input type="date" value={dayDraft} onChange={(event) => setDayDraft(event.target.value)} /></label>
        <button className={styles.filterButton} type="submit">Filter</button>
      </form>

      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead><tr><th scope="col" className={styles.colDate}>Date &amp; time</th><th scope="col" className={styles.colUser}>User</th><th scope="col" className={styles.colAction}>Action</th><th scope="col">Description</th><th scope="col" className={styles.colExpand}><span className="sr-only">Details</span></th></tr></thead>
          <tbody>
            {pageEvents.map((event) => {
              const kind = category(event.action);
              const open = expanded === event.id;
              const roleKey = event.actorRole === "admin" || event.actorRole === "provider" || event.actorRole === "customer" || event.actorRole === "system" ? event.actorRole : "removed";
              return <RowGroup key={event.id} open={open}
                row={<>
                  <td className={styles.when}>{whenLabel(event.createdAt)}</td>
                  <td><div className={styles.user}><strong>{event.actor}</strong><span className={`${styles.badge} ${styles[roleKey]}`}>{roleLabel(event.actorRole)}</span></div></td>
                  <td><span className={`${styles.badge} ${styles[kind]}`}>{eventLabel(event.action)}</span></td>
                  <td><div className={styles.description} title={describe(event)}>{describe(event)}</div></td>
                  <td className={styles.expandCell}><button className={styles.expand} type="button" aria-label={`${open ? "Collapse" : "Expand"} details for ${readable(event.action)}`} aria-expanded={open} onClick={() => setExpanded(open ? null : event.id)}>{open ? <ChevronUp className={iconSize.sm} /> : <ChevronDown className={iconSize.sm} />}</button></td>
                </>}
                detail={<div className={styles.details}>
                  <dl><dt>Actor ID</dt><dd>{event.actorId ?? "System"}</dd><dt>Target table</dt><dd>{event.targetTable ?? "—"}</dd><dt>Target ID</dt><dd>{event.targetId ?? "—"}</dd>{event.reason && <><dt>Reason</dt><dd>{event.reason}</dd></>}</dl>
                  <pre>{JSON.stringify(event.details ?? {}, null, 2)}</pre>
                </div>} />;
            })}
            {visibleEvents.length === 0 && <tr><td className={styles.empty} colSpan={5}>No audit events match these filters.</td></tr>}
          </tbody>
        </table>
      </div>

      <nav className={styles.footer} aria-label="Audit log pages">
        <p>{visibleEvents.length ? <>Showing <strong>{firstIndex + 1}–{firstIndex + pageEvents.length}</strong> of <strong>{visibleEvents.length}</strong> records</> : <>Showing <strong>0</strong> records</>}</p>
        <div className={styles.pager}>
          <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft className={iconSize.sm} aria-hidden="true" /></button>
          <span aria-live="polite">Page <strong>{currentPage}</strong> of <strong>{pageCount}</strong></span>
          <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page"><ChevronRight className={iconSize.sm} aria-hidden="true" /></button>
        </div>
      </nav>
    </section>
  </main>;
}

function RowGroup({ row, detail, open }: { row: React.ReactNode; detail: React.ReactNode; open: boolean }) {
  return <>
    <tr>{row}</tr>
    {open && <tr className={styles.detailRow}><td colSpan={5}>{detail}</td></tr>}
  </>;
}
