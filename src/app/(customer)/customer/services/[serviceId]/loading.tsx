import styles from "./page.module.css";

export default function ServiceLoading() {
  return <section className={styles.page} aria-busy="true" aria-label="Loading service details">
    <div className={styles.skeleton} />
    <div className={styles.skeletonTitle} />
    <div className={styles.skeletonPrice} />
    <div className={styles.skeletonBody} />
    <div className={styles.skeletonBody} />
    <div className={styles.skeletonButton} />
  </section>;
}
