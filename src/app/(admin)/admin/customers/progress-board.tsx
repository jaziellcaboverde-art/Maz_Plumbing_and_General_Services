"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import styles from "./page.module.css";

export type CustomerProject = {
  id: string;
  status: string;
  customer: string;
  customerDetail: string;
  service: string;
  description: string;
  provider: string;
  updatedAt: string;
  createdAt: string;
};

const COLUMNS = [
  { title: "Requests", statuses: ["draft", "open", "offered"] },
  { title: "Confirmed", statuses: ["accepted", "quoted", "deposit_paid", "scheduled"] },
  { title: "In progress", statuses: ["on_the_way", "in_progress"] },
  { title: "Closed", statuses: ["done", "signed", "balance_paid", "completed", "cancelled"] },
] as const;

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: string) {
  if (status === "cancelled") return styles.cancelled;
  if (["done", "signed", "balance_paid", "completed"].includes(status)) return styles.complete;
  if (["on_the_way", "in_progress", "scheduled", "deposit_paid", "accepted"].includes(status)) return styles.active;
  return styles.waiting;
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-PH", { day: "numeric", month: "short", timeZone: "Asia/Manila" });
}

export function CustomerProgressBoard({ projects }: { projects: CustomerProject[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => [
      project.customer,
      project.customerDetail,
      project.service,
      project.description,
      project.provider,
      statusLabel(project.status),
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [projects, query]);

  const activeCount = filtered.filter((project) => ["on_the_way", "in_progress"].includes(project.status)).length;

  return <>
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden="true" size={18} />
        <span className={styles.visuallyHidden}>Search customer projects</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers or projects" />
      </label>
      <div className={styles.boardSummary}>
        <span>{filtered.length} of {projects.length} projects</span>
        <span><i aria-hidden="true" />{activeCount} in progress</span>
      </div>
    </div>

    <div className={styles.board} aria-label="Customer project progress board">
      {COLUMNS.map((column) => {
        const cards = filtered.filter((project) => (column.statuses as readonly string[]).includes(project.status));
        return <section className={styles.column} key={column.title} aria-labelledby={`column-${column.title.replaceAll(" ", "-")}`}>
          <header className={styles.columnHeader}>
            <h2 id={`column-${column.title.replaceAll(" ", "-")}`}>{column.title}</h2>
            <span>{cards.length}</span>
          </header>
          <div className={styles.cards}>
            {cards.map((project) => <article className={styles.card} key={project.id}>
              <div className={styles.cardHeading}>
                <span className={styles.avatar} data-list-avatar="true" aria-hidden="true">{project.customer.slice(0, 1).toUpperCase()}</span>
                <div><strong>{project.customer}</strong><small>{project.customerDetail}</small></div>
              </div>
              <h3>{project.service}</h3>
              <p className={styles.description}>{project.description}</p>
              <div className={styles.cardMeta}>
                <span className={`${styles.status} ${statusClass(project.status)}`}>{statusLabel(project.status)}</span>
                <span className={styles.provider} title={`Provider: ${project.provider}`}>{project.provider}</span>
              </div>
              <footer className={styles.cardFooter}>
                <span>Opened {dateLabel(project.createdAt)}</span>
                <time dateTime={project.updatedAt}>Updated {dateLabel(project.updatedAt)}</time>
              </footer>
            </article>)}
            {!cards.length && <p className={styles.emptyColumn}>{filtered.length ? "No projects in this stage." : "No customer projects yet."}</p>}
          </div>
        </section>;
      })}
    </div>
  </>;
}
