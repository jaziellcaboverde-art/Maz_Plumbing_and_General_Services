import type { ComponentType, ReactNode } from "react";
import { Inbox, type LucideProps } from "lucide-react";
import styles from "./empty-state.module.css";

type EmptyStateProps = {
  /** Say what to do: "No bookings yet. Book a service." */
  title: string;
  description?: string;
  /** A Lucide icon component. Defaults to the inbox. */
  icon?: ComponentType<LucideProps>;
  /** The one action that fills the empty screen, usually a Button. */
  action?: ReactNode;
};

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <Icon className={styles.icon} aria-hidden="true" />
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action}
    </div>
  );
}
