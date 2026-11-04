import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import styles from "./portal.module.css";

export function PortalStats({
  items,
}: {
  items: {
    label: string;
    value: ReactNode;
    href: string;
    icon: LucideIcon;
    tone?: "brand" | "success" | "warning" | "neutral";
  }[];
}) {
  return (
    <div className={styles.stats}>
      {items.map(({ label, value, href, icon: Icon, tone = "brand" }) => (
        <Link className={styles.stat} href={href} key={label} data-tone={tone}>
          <span className={styles.statLabel}>{label}</span>
          <strong className={styles.statValue}>{value}</strong>
          <span className={styles.statSymbol}>
            <Icon className={styles.statIcon} aria-hidden="true" />
          </span>
        </Link>
      ))}
    </div>
  );
}

export function PortalPanel({
  title,
  action,
  children,
  icon: Icon,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>
          {Icon && <Icon className={styles.panelIcon} aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PortalTabs({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string; active?: boolean }[];
}) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {items.map((item) => (
        <Link
          className={styles.tab}
          key={item.href}
          href={item.href}
          scroll={false}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function PortalTable({
  label,
  columns,
  rows,
  empty = "No records found.",
}: {
  label: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty?: string;
}) {
  if (!rows.length)
    return (
      <div className={styles.empty}>
        <Inbox className={styles.emptyIcon} aria-hidden="true" />
        <p>{empty}</p>
      </div>
    );
  return (
    <div
      className={styles.tableWrap}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className={styles.table}>
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, i) => (
                <td key={columns[i]} data-label={columns[i]}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
