import styles from "./reports-dashboard.module.css";

export default function ReportsLoading() {
  return <main className={styles.page} role="status" aria-busy="true">Loading reports…</main>;
}
