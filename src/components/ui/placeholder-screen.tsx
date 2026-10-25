import styles from "./placeholder-screen.module.css";
import { PageHeading } from "@/components/layout/page-heading";

/** Stand in for a screen that a later phase builds. Replace the page, not this. */
export function PlaceholderScreen({ title, phase }: { title: string; phase: number }) {
  return (
    <section className={styles.screen}>
      <PageHeading title={title} description={`This screen is built in Phase ${phase}.`} />
    </section>
  );
}
