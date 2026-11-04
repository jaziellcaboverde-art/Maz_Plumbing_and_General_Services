import styles from "./dashboard-skeleton.module.css";

export function DashboardSkeleton() {
  return (
    <div
      className={styles.root}
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
    >
      <span className="sr-only">Loading dashboard…</span>
      <div className={styles.heading} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true">
        {[0, 1, 2].map((key) => (
          <div className={styles.card} key={key}>
            <div className={styles.line} />
            <div className={styles.line} />
          </div>
        ))}
      </div>
    </div>
  );
}
