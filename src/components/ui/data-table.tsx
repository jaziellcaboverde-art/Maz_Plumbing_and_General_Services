import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import { EmptyState } from "./empty-state";
import { Spinner } from "./spinner";
import { StatusMessage } from "./status-message";
import styles from "./data-table.module.css";

export type Column<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  /** Numbers and peso amounts: right aligned. */
  numeric?: boolean;
};

type DataTableProps<Row> = {
  /** Read by screen readers. Do not repeat the page title on screen. */
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  loading?: boolean;
  /** What went wrong and how to fix it. */
  error?: string;
  /** Shown when there are no rows. Defaults to a plain message. */
  empty?: ReactNode;
};

/** For 5 or more rows. Fewer rows belong in a List. The table scrolls sideways on narrow screens. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  loading = false,
  error,
  empty,
}: DataTableProps<Row>) {
  const hasRows = rows.length > 0;
  const showStateRow = loading || Boolean(error) || !hasRows;

  return (
    <div className={styles.scroll} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table} aria-busy={loading || undefined}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cx(styles.cell, styles.head, column.numeric && styles.numeric)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {showStateRow ? (
            <tr>
              <td colSpan={columns.length} className={styles.cell}>
                {loading ? (
                  <p className={styles.loading} role="status">
                    <Spinner />
                    <span>Loading</span>
                  </p>
                ) : error ? (
                  <StatusMessage status="error">{error}</StatusMessage>
                ) : (
                  (empty ?? <EmptyState title="Nothing to show yet." />)
                )}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={cx(styles.cell, column.numeric && styles.numeric)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
