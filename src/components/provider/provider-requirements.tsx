import type { ReactNode } from "react";
import { OPTIONAL_PROVIDER_DOCUMENTS, REQUIRED_PROVIDER_DOCUMENTS } from "@/lib/provider/requirements";
import styles from "./provider-requirements.module.css";

/** The documents a provider must upload to apply. Shown before sign-up and again on the application form. */
export function ProviderRequirements({ headingLevel = 2, action }: { headingLevel?: 2 | 3; action?: ReactNode }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className={styles.requirements} aria-labelledby="provider-requirements-heading">
      <Heading id="provider-requirements-heading">Provider hiring requirements</Heading>
      <p>You must upload every required document to apply. Admins review them before approving you.</p>
      <ul>
        {REQUIRED_PROVIDER_DOCUMENTS.map((item) => <li key={item}>{item}</li>)}
      </ul>
      <p className={styles.optionalLabel}>Optional, but they help your application:</p>
      <ul>
        {OPTIONAL_PROVIDER_DOCUMENTS.map((item) => <li key={item}>{item}</li>)}
      </ul>
      {action && <div className={styles.action}>{action}</div>}
    </section>
  );
}
