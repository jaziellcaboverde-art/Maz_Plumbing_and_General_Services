"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import styles from "./provider-application-card.module.css";

type Props = {
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

export function ProviderApplicationCard({ applicantId, name, mobile, serviceArea, dailyRate, submittedAt, reviewedAt, rejectionReason, status }: Props) {
  const [open, setOpen] = useState(false);
  const statusLabel = status === "pending" ? "Pending review" : status === "approved" ? "Approved" : "Rejected";

  return <>
    <article className={styles.card}>
      <span className={styles.avatar} data-list-avatar="true" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>
      <div className={styles.cardInfo}>
        <h2>{name}</h2>
        <p>{serviceArea} | {mobile}</p>
        <span className={`${styles.status} ${status === "pending" ? styles.pending : status === "approved" ? styles.approved : styles.rejected}`}>{statusLabel}</span>
      </div>
      <Button type="button" variant={status === "pending" ? "primary" : "secondary"} onClick={() => setOpen(true)}>
        {status === "pending" ? "Review application" : "View decision"}
      </Button>
    </article>
    <Modal open={open} onClose={() => setOpen(false)} title={`${name} application`}>
      <dl className={styles.details}>
        <div><dt>Applicant</dt><dd>{name}</dd></div>
        <div><dt>Mobile</dt><dd>{mobile}</dd></div>
        <div><dt>Service area</dt><dd>{serviceArea}</dd></div>
        <div><dt>Expected daily rate</dt><dd>PHP {dailyRate}</dd></div>
        <div><dt>Submitted</dt><dd>{submittedAt}</dd></div>
        <div><dt>Status</dt><dd>{statusLabel}</dd></div>
        {reviewedAt && <div><dt>Decision recorded</dt><dd>{reviewedAt}</dd></div>}
        {rejectionReason && <div><dt>Admin message</dt><dd>{rejectionReason}</dd></div>}
      </dl>
      <Link className={styles.reviewLink} href={`/admin/provider-applications/${applicantId}`} onClick={() => setOpen(false)}>
        {status === "pending" ? "Review documents and record a decision" : "View application decision"}
      </Link>
    </Modal>
  </>;
}
