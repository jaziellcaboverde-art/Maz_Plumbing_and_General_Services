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
 * One nav element for every role. Bottom tabs on phones and a vertical
 * sidebar on larger screens. Lives in the layout shell, never in a page.
 */
export function RoleNav({
  role,
  identityName = "Account",
  identityRole,
}: {
  role: Role;
  identityName?: string;
  identityRole?: string;
}) {
  const pathname = usePathname();
  const resolvedIdentityRole = identityRole ?? `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  const { home, items } = NAV[role];
  const hasMore = items.some((i) => i.overflow);
  const moreHref = `${home}/${ADMIN_MORE.slug}`;
  const moreActive =
    matches(pathname, moreHref, false) ||
    matches(pathname, `${home}/settings`, false) ||
    items.some((i) => i.overflow && matches(pathname, itemHref(role, i), false));

  return (
    <nav aria-label="Main" className={styles.nav}>
      <Link className={styles.brand} data-sidebar-brand href={home} aria-label="MAZ Plumbing and General Services home">
        <img src="/maz-plumbing-logo.jpg" alt="" />
        <span data-sidebar-label><strong>MAZ Plumbing</strong><small>Service portal</small></span>
      </Link>
      <div className={styles.mobileIdentity}>
        <strong>{identityName}</strong>
        <span>{resolvedIdentityRole}</span>
      </div>
      <ul className={styles.list}>
        {items.map((item, index) => {
          const href = itemHref(role, item);
          const active = matches(pathname, href, href === home) &&
            !items.some((other) => other !== item && itemHref(role, other).startsWith(`${href}/`) && matches(pathname, itemHref(role, other), false));
          const Icon = item.icon;
          const showGroup = role === "admin" && item.group && (index === 0 || items[index - 1].group !== item.group);
          return (
            <li
              key={href}
              className={item.overflow ? styles.desktopOnly : styles.item}
            >
              {showGroup ? <span className={styles.groupHeading} data-sidebar-label>{item.group}</span> : null}
              <Link
                href={href}
                className={styles.link}
                data-sidebar-nav-link
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden="true" className={styles.icon} />
                <span data-sidebar-label>{item.label}</span>
              </Link>
            </li>
          );
        })}
        {hasMore ? (
          <li className={styles.mobileOnly}>
            <Link
              href={moreHref}
              className={styles.link}
              data-sidebar-nav-link
              aria-current={moreActive ? "page" : undefined}
            >
              <ADMIN_MORE.icon aria-hidden="true" className={styles.icon} />
              <span data-sidebar-label>{ADMIN_MORE.label}</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
