"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import styles from "./page.module.css";
import iconSize from "@/components/ui/icon-size.module.css";

export type CustomerRow = {
  id: string;
  name: string;
  contactName: string;
  accountType: "household" | "business";
  email: string;
  mobile: string;
  projectCount: number;
  latestService: string | null;
  latestStatus: string | null;
  latestStage: string;
  lastActive: string;
};

const PAGE_SIZE = 10;
const STAGE_OPTIONS = ["Requests", "Confirmed", "In progress", "Closed", "No projects"];

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "cancelled") return styles.cancelled;
  if (["done", "signed", "balance_paid", "completed"].includes(status)) return styles.complete;
  if (["on_the_way", "in_progress", "scheduled", "deposit_paid", "accepted", "quoted"].includes(status)) return styles.active;
  return styles.waiting;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dayKey(value: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date(value));
}

export function CustomersTable({ customers }: { customers: CustomerRow[] }) {
  // What the person is typing, and what the Filter button has applied.
  const [searchDraft, setSearchDraft] = useState("");
  const [dayDraft, setDayDraft] = useState("");
  const [applied, setApplied] = useState({ search: "", day: "" });
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = applied.search.trim().toLocaleLowerCase();
    return customers.filter((customer) => {
      if (stage && customer.latestStage !== stage) return false;
      if (applied.day && dayKey(customer.lastActive) !== applied.day) return false;
      if (!needle) return true;
      return [customer.name, customer.contactName, customer.email, customer.mobile, customer.latestService ?? ""].some((value) => value.toLocaleLowerCase().includes(needle));
    });
  }, [applied, customers, stage]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const firstIndex = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(firstIndex, firstIndex + PAGE_SIZE);

  function applyFilters() {
    setApplied({ search: searchDraft, day: dayDraft });
    setPage(1);
  }

  return <section className={styles.card} aria-label="Customers">
    <form className={styles.toolbar} onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
      <label className={styles.search}><Search className={iconSize.sm} aria-hidden="true" /><span className="sr-only">Search customers</span><input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search by name, email or mobile…" /></label>
      <label className={styles.control}><span className="sr-only">Filter by latest project stage</span>
        <select value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}>
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className={iconSize.sm} aria-hidden="true" />
      </label>
      <label className={styles.control}><span className="sr-only">Last active on</span><input type="date" value={dayDraft} onChange={(event) => setDayDraft(event.target.value)} /></label>
      <button className={styles.filterButton} type="submit">Filter</button>
    </form>

    <div className={styles.scroll}>
      <table className={styles.table}>
        <thead><tr><th scope="col" className={styles.colCustomer}>Customer</th><th scope="col" className={styles.colContact}>Contact</th><th scope="col" className={styles.colProjects}>Projects</th><th scope="col" className={styles.colLatest}>Latest project</th><th scope="col" className={styles.colActive}>Last active</th></tr></thead>
        <tbody>
          {visible.map((customer) => <tr key={customer.id}>
            <th scope="row">
              <div className={styles.customer}>
                <strong>{customer.name}</strong>
                <span className={`${styles.badge} ${customer.accountType === "business" ? styles.business : styles.household}`}>{customer.accountType === "business" ? "Business" : "Household"}</span>
              </div>
              {customer.contactName && <small>{customer.contactName}</small>}
            </th>
            <td><div>{customer.email}</div><small>{customer.mobile}</small></td>
            <td>{customer.projectCount}</td>
            <td>{customer.latestService && customer.latestStatus
              ? <><div>{customer.latestService}</div><span className={`${styles.badge} ${statusClass(customer.latestStatus)}`}>{statusLabel(customer.latestStatus)}</span></>
              : <small>No projects yet</small>}</td>
            <td className={styles.when}><time dateTime={customer.lastActive}>{dateLabel(customer.lastActive)}</time></td>
          </tr>)}
          {filtered.length === 0 && <tr><td className={styles.empty} colSpan={5}>{customers.length ? "No customers match these filters." : "No customers yet."}</td></tr>}
        </tbody>
      </table>
    </div>

    <nav className={styles.footer} aria-label="Customer pages">
      <p>{filtered.length ? <>Showing <strong>{firstIndex + 1}–{firstIndex + visible.length}</strong> of <strong>{filtered.length}</strong> customers</> : <>Showing <strong>0</strong> customers</>}</p>
      <div className={styles.pager}>
        <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft className={iconSize.sm} aria-hidden="true" /></button>
        <span aria-live="polite">Page <strong>{currentPage}</strong> of <strong>{pageCount}</strong></span>
        <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page"><ChevronRight className={iconSize.sm} aria-hidden="true" /></button>
      </div>
    </nav>
  </section>;
}
