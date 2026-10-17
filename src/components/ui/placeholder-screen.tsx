import styles from "./placeholder-screen.module.css";

/** Stand in for a screen that a later phase builds. Replace the page, not this. */
export function PlaceholderScreen({ title, phase }: { title: string; phase: number }) {
  return (
    <section className={styles.screen}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.note}>This screen is built in Phase {phase}.</p>
    </section>
  );
}
