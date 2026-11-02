import Link from "next/link";
import styles from "../auth.module.css";

export default function LinkExpiredPage() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>This link no longer works</h1>
      <p>It was already used or it has expired. Ask for a new one.</p>
      <div className={styles.links}>
        <Link className={styles.link} href="/forgot-password">
          Send a new reset link
        </Link>
        <Link className={styles.link} href="/login">
          Log in
        </Link>
      </div>
    </div>
  );
}
