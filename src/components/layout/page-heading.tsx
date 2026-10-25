import type { ReactNode } from "react";
import styles from "./page-heading.module.css";

export function PageHeading({ title, description, trailing }: { title: string; description?: string; trailing?: ReactNode }) {
  return <header className={styles.header}>
    <div className={styles.copy}>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {trailing}
  </header>;
}
