import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
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
      <li className={styles.row}>
        <Link className={styles.link} href={`${NAV[role].home}/profile`}>
          <UserRound aria-hidden="true" className={styles.icon} />
          Profile
        </Link>
      </li>
      <li className={styles.row}>
        <Link className={styles.link} href={`${NAV[role].home}/settings`}>
          <Settings aria-hidden="true" className={styles.icon} />
          Settings
        </Link>
      </li>
    </ul>
  );
}
