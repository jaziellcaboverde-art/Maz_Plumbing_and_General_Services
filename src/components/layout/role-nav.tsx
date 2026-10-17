"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_MORE, NAV, itemHref, type Role } from "./nav-config";
import styles from "./role-nav.module.css";

function matches(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * One nav element for every role. Bottom tab bar on phones, inline in the
 * header on larger screens. Lives in the layout shell, never in a page.
 */
export function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const { home, items } = NAV[role];
  const hasMore = items.some((i) => i.overflow);
  const moreHref = `${home}/${ADMIN_MORE.slug}`;
  const moreActive =
    matches(pathname, moreHref, false) ||
    items.some((i) => i.overflow && matches(pathname, itemHref(role, i), false));

  return (
    <nav aria-label="Main" className={styles.nav}>
      <ul className={styles.list}>
        {items.map((item) => {
          const href = itemHref(role, item);
          const active = matches(pathname, href, href === home);
          const Icon = item.icon;
          return (
            <li
              key={href}
              className={item.overflow ? styles.desktopOnly : styles.item}
            >
              <Link
                href={href}
                className={styles.link}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" className={styles.icon} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
        {hasMore ? (
          <li className={styles.mobileOnly}>
            <Link
              href={moreHref}
              className={styles.link}
              aria-current={moreActive ? "page" : undefined}
            >
              <ADMIN_MORE.icon aria-hidden="true" className={styles.icon} />
              <span>{ADMIN_MORE.label}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
