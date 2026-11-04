import Link from "next/link";
import { Settings, UserRound } from "lucide-react";
import { NAV, itemHref, navEntries, type Role } from "./nav-config";
import styles from "./more-list.module.css";

/** Destinations that do not fit in the 4 phone tabs. Admin only for now. */
export function MoreList({ role }: { role: Role }) {
  const entries = navEntries(role);
  return (
    <ul className={styles.list}>
      {entries.map(({ item, menu, children }) => {
        if (menu) {
          const supporting = children.filter((child) => child.overflow);
          if (!supporting.length) return null;
          const Icon = menu.icon;
          return (
            <li className={styles.section} key={menu.id}>
              <h2>
                <Icon className={styles.icon} aria-hidden="true" />
                {menu.label}
              </h2>
              <ul className={styles.list}>
                {supporting.map((child) => (
                  <li className={styles.row} key={child.slug}>
                    <Link className={styles.link} href={itemHref(role, child)}>
                      {menu.labels?.[child.slug] ?? child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          );
        }
        if (!item.overflow) return null;
        const Icon = item.icon;
        return (
          <li className={styles.row} key={item.slug}>
            <Link className={styles.link} href={itemHref(role, item)}>
              <Icon className={styles.icon} aria-hidden="true" />
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
