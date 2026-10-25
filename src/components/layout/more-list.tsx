import Link from "next/link";
import { NAV, itemHref, type Role } from "./nav-config";
import styles from "./more-list.module.css";

/** Destinations that do not fit in the 4 phone tabs. Admin only for now. */
export function MoreList({ role }: { role: Role }) {
  const items = NAV[role].items.filter((i) => i.overflow);
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <li key={item.slug} className={styles.row}>
            <Link className={styles.link} href={itemHref(role, item)}>
              <Icon aria-hidden="true" className={styles.icon} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
