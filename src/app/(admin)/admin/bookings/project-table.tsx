"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import styles from "./page.module.css";
import iconSize from "@/components/ui/icon-size.module.css";

export type ProjectRow = {
  id: string;
  status: string;
  customer: string;
  customerDetail: string;
  service: string;
  description: string;
  provider: string;
  quoteAmount: string | null;
  quoteStatus: string | null;
  updatedAt: string;
};

const STAGE: Record<string, number> = {
  draft: 1,
  open: 1,
  offered: 2,
  accepted: 2,
  quoted: 2,
  deposit_paid: 3,
  scheduled: 3,
  on_the_way: 4,
  in_progress: 4,
  done: 5,
  signed: 5,
  balance_paid: 5,
  completed: 5,
  cancelled: 0,
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string) {
  if (status === "cancelled") return styles.cancelled;
  if (["completed", "balance_paid", "signed", "done"].includes(status)) return styles.complete;
  if (["in_progress", "on_the_way", "scheduled", "deposit_paid", "accepted"].includes(status)) return styles.active;
  return styles.waiting;
}

function quoteTone(status: string) {
  if (status === "accepted" || status === "approved") return styles.complete;
  if (status === "declined" || status === "expired") return styles.cancelled;
  return styles.waiting;
}

function quoteLabel(status: string) {
  if (status === "proposed") return "Awaiting approval";
  if (status === "approved") return "Approved, awaiting customer";
  return statusLabel(status);
}

function projectStage(status: string) {
  return STAGE[status] ?? 0;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ProjectTable({ projects }: { projects: ProjectRow[] }) {
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
      project.quoteAmount ?? "",
      project.quoteStatus ? quoteLabel(project.quoteStatus) : "",
      statusLabel(project.status),
    ].some((value) => value.toLocaleLowerCase().includes(needle)));
  }, [projects, query]);

  return <>
    <div className={styles.toolbar}>
      <label className={styles.search}>
        <Search aria-hidden="true" className={iconSize.md} />
        <span className={styles.visuallyHidden}>Search customer projects</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customers or projects" />
      </label>
      <p>{filtered.length} of {projects.length} projects</p>
    </div>
    <div className={styles.tableCard}>
      {filtered.length ? <div className={styles.tableScroll}>
        <table>
          <thead>
            <tr>
              <th scope="col" className={styles.alignStart}>Customer</th>
              <th scope="col" className={styles.alignStart}>Project</th>
              <th scope="col">Status</th>
              <th scope="col">Stage</th>
              <th scope="col">Provider</th>
              <th scope="col">Quote</th>
              <th scope="col">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((project) => {
              const stage = projectStage(project.status);
              return <tr key={project.id}>
                <td className={styles.alignStart}>
                  <div className={styles.customerCell}>
                    <span className={styles.avatar} data-list-avatar="true" aria-hidden="true">{project.customer.slice(0, 1).toUpperCase()}</span>
                    <span><strong>{project.customer}</strong><small>{project.customerDetail}</small></span>
                  </div>
                </td>
                <td className={styles.alignStart}>
                  <strong>{project.service}</strong>
                  <small className={styles.description}>{project.description}</small>
                </td>
                <td><span className={`${styles.status} ${statusTone(project.status)}`}>{statusLabel(project.status)}</span></td>
                <td>
                  <div className={styles.progressCell}>
                    <span>{stage ? `${stage}/5` : "—"}</span>
                    <progress value={stage} max={5} aria-label={stage ? `Project stage ${stage} of 5` : "Project cancelled"} />
                  </div>
                </td>
                <td>{project.provider}</td>
                <td>{project.quoteStatus && project.quoteAmount
                  ? <div className={styles.quoteCell}><strong>{project.quoteAmount}</strong><span className={`${styles.status} ${quoteTone(project.quoteStatus)}`}>{quoteLabel(project.quoteStatus)}</span></div>
                  : <span className={styles.noQuote}>No quote yet</span>}</td>
                <td><time dateTime={project.updatedAt}>{dateLabel(project.updatedAt)}</time></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div> : <p className={styles.empty}>{projects.length ? "No customer projects match your search." : "No customer projects yet."}</p>}
    </div>
  </>;
}
