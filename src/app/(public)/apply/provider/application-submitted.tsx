import Link from "next/link";
import { Check, FileText } from "lucide-react";
import styles from "./application-submitted.module.css";

export type ApplicationSummary = {
  reference: string;
  name: string;
  email: string;
  mobile: string;
  areas: string[];
  services: string[];
  documents: string[];
};

/** Shown in place of the form once the application is saved. The summary scrolls when it is long. */
export function ApplicationSubmitted({ summary }: { summary: ApplicationSummary }) {
  return (
    <section className={styles.card} aria-labelledby="application-submitted-title">
      <div className={styles.badge}><Check className={styles.badgeIcon} aria-hidden="true" /></div>
      <h1 id="application-submitted-title" className={styles.title}>Thank you for applying</h1>
      <p className={styles.intro}>
        Your application was sent to the MAZ admin team. We also sent a confirmation link to {summary.email}.
        Confirm your email so you can log in and follow your application.
      </p>

      <div className={styles.summary} tabIndex={0} role="region" aria-label="Application summary">
        <dl className={styles.rows}>
          <div className={styles.row}><dt>Reference</dt><dd className={styles.reference}>{summary.reference}</dd></div>
          <div className={styles.row}><dt>Name</dt><dd>{summary.name}</dd></div>
          <div className={styles.row}><dt>Email</dt><dd>{summary.email}</dd></div>
          <div className={styles.row}><dt>Mobile</dt><dd>{summary.mobile}</dd></div>
          <div className={styles.row}><dt>Areas you serve</dt><dd>{summary.areas.join(", ")}</dd></div>
          <div className={styles.row}><dt>Services</dt><dd>{summary.services.join(", ")}</dd></div>
        </dl>

        <h2 className={styles.heading}>Documents submitted</h2>
        <ul className={styles.documents}>
          {summary.documents.map((label) => (
            <li key={label}><FileText className={styles.docIcon} aria-hidden="true" />{label}</li>
          ))}
        </ul>

        <h2 className={styles.heading}>What happens next</h2>
        <ol className={styles.next}>
          <li>An admin reviews your details and documents. They may call your references.</li>
          <li>We email you the result at {summary.email}, whether you are approved or not.</li>
          <li>If you are approved, the email includes a secure link to set your password and start taking jobs.</li>
        </ol>
        <p className={styles.note}>Keep your reference number if you need to contact us about your application.</p>
      </div>

      <Link className={styles.home} href="/">Back to home page</Link>
    </section>
  );
}
