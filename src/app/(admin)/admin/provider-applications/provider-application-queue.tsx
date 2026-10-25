"use client";

import { useMemo, useState } from "react";
import styles from "./queue.module.css";
import { ProviderApplicationCard } from "./provider-application-card";

export type ApplicationQueueItem = {
  applicantId: string;
  name: string;
  mobile: string;
  serviceArea: string;
  dailyRate: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  status: "pending" | "approved" | "rejected";
};

const TABS = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
] as const;

export function ProviderApplicationQueue({ applications }: { applications: ApplicationQueueItem[] }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("pending");
  const visible = useMemo(() => applications.filter((application) => application.status === activeTab), [applications, activeTab]);
  const recentlyDecided = useMemo(() => applications
    .filter((application) => application.status !== "pending" && application.reviewedAt)
    .sort((a, b) => Date.parse(b.reviewedAt ?? "") - Date.parse(a.reviewedAt ?? ""))
    .slice(0, 5), [applications]);

  return <div className={styles.queue}>
    <div className={styles.tabs} role="group" aria-label="Provider application status">
      {TABS.map((tab) => {
        const count = applications.filter((application) => application.status === tab.id).length;
        const active = activeTab === tab.id;
        return <button
          className={active ? styles.activeTab : styles.tab}
          key={tab.id}
          type="button"
          aria-pressed={active}
          onClick={() => setActiveTab(tab.id)}
        >
          {tab.label}<span>{count}</span>
        </button>;
      })}
    </div>

    <section className={styles.panel} aria-label={`${activeTab} provider applications`}>
      <header className={styles.panelHeading}>
        <div>
          <p className={styles.eyebrow}>MAZ Provider Network</p>
          <h2>{activeTab === "pending" ? "Needs your review" : activeTab === "approved" ? "Approved providers" : "Not approved"}</h2>
          <p>{visible.length ? `${visible.length} application${visible.length === 1 ? " is" : "s are"} in this queue.` : "There are no applications in this queue."}</p>
        </div>
      </header>

      {visible.length ? <ul className={styles.list}>
        {visible.map((application, index) => <li key={application.applicantId} style={{ animationDelay: `${index * 45}ms` }}>
          <ProviderApplicationCard {...application} />
        </li>)}
      </ul> : <div className={styles.empty}>
        <span aria-hidden="true">✓</span>
        <h3>{activeTab === "pending" ? "All caught up" : "No applications here yet"}</h3>
        <p>{activeTab === "pending" ? "There are no provider applications waiting for review." : "Applications with this decision will appear here."}</p>
      </div>}
    </section>

    {recentlyDecided.length > 0 && <section className={styles.history} aria-labelledby="recent-decisions-heading">
      <header>
        <h2 id="recent-decisions-heading">Recently decided</h2>
        <span>Latest {recentlyDecided.length}</span>
      </header>
      <ul>
        {recentlyDecided.map((application) => <li key={application.applicantId}>
          <div className={styles.historyAvatar} data-list-avatar="true" aria-hidden="true">{application.name.slice(0, 1).toUpperCase()}</div>
          <div className={styles.historyInfo}>
            <strong>{application.name}</strong>
            <small>{application.serviceArea} | {application.reviewedAt}</small>
          </div>
          <span className={application.status === "approved" ? styles.approved : styles.rejected}>
            {application.status === "approved" ? "Approved" : "Rejected"}
          </span>
        </li>)}
      </ul>
    </section>}
  </div>;
}
