import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cx } from "@/lib/cx";
import { EmptyState } from "./empty-state";
import { Spinner } from "./spinner";
import { StatusMessage } from "./status-message";
import styles from "./list.module.css";

export type ListItem = {
  id: string;
  title: string;
  description?: string;
  /** Right side: an amount, a status chip. */
  trailing?: ReactNode;
  /** A row with href or onSelect is a link or button. Other rows are plain text. */
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

type ListProps = {
  /** Read by screen readers. */
  label: string;
  items: ListItem[];
  loading?: boolean;
  /** What went wrong and how to fix it. */
  error?: string;
  /** Shown when there are no items. Defaults to a plain message. */
  empty?: ReactNode;
};

/** Full width rows with a light divider. For fewer than 5 records. More belong in a DataTable. */
export function List({ label, items, loading = false, error, empty }: ListProps) {
  if (loading) {
    return (
      <p className={styles.state} role="status">
        <Spinner />
        <span>Loading</span>
      </p>
    );
  }
  if (error) return <StatusMessage status="error">{error}</StatusMessage>;
  if (items.length === 0) return <>{empty ?? <EmptyState title="Nothing to show yet." />}</>;

  return (
    <ul className={styles.list} aria-label={label}>
      {items.map((item) => {
        const content = (
          <>
            <span className={styles.text}>
              <span className={styles.title}>{item.title}</span>
              {item.description && <span className={styles.description}>{item.description}</span>}
            </span>
            {item.trailing && <span className={styles.trailing}>{item.trailing}</span>}
            {(item.href || item.onSelect) && <ChevronRight className={styles.chevron} aria-hidden="true" />}
          </>
        );
        return (
          <li key={item.id} className={styles.item}>
            {item.href && !item.disabled ? (
              <a className={cx(styles.row, styles.action)} href={item.href}>
                {content}
              </a>
            ) : item.onSelect ? (
              <button
                type="button"
                className={cx(styles.row, styles.action)}
                onClick={item.onSelect}
                disabled={item.disabled}
              >
                {content}
              </button>
            ) : (
              <div className={cx(styles.row, item.disabled && styles.disabled)}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
