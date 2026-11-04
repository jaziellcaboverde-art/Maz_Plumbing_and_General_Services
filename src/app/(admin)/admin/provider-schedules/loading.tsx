import styles from "./page.module.css";

export default function ProviderSchedulesLoading() {
  return <section className={styles.page} role="status" aria-busy="true">Loading provider schedules…</section>;
}
