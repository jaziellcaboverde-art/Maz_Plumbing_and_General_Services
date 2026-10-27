import { Suspense } from "react";
import { ExpiredLinkRecovery } from "./expired-link-recovery";
import styles from "../auth.module.css";

export default function LinkExpiredPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>This link no longer works</h1>
      <p>It may have already been used or expired. Enter your email to request a fresh link.</p>
      <Suspense fallback={<p>Loading link options…</p>}>
        <ExpiredLinkRecovery />
      </Suspense>
    </div>
  );
}
