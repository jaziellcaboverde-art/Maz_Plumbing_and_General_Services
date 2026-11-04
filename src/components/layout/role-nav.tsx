"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  ADMIN_MORE,
  NAV,
  itemHref,
  navEntries,
  type NavItem,
  type Role,
} from "./nav-config";
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
  const resolvedIdentityRole =
    identityRole ?? `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
  const { home, items } = NAV[role];
  const hasMore = items.some((i) => i.overflow);
  const moreHref = `${home}/${ADMIN_MORE.slug}`;
  const moreActive =
    matches(pathname, moreHref, false) ||
    matches(pathname, `${home}/settings`, false) ||
    items.some(
      (i) => i.overflow && matches(pathname, itemHref(role, i), false),
    );

  const entries = navEntries(role);
  const [expanded, setExpanded] = useState<{
    path: string;
    values: Record<string, boolean>;
  }>({ path: pathname, values: {} });
  function isActive(item: NavItem) {
    const href = itemHref(role, item);
    return (
      matches(pathname, href, href === home) &&
      !items.some(
        (other) =>
          other !== item &&
          itemHref(role, other).startsWith(href + "/") &&
          matches(pathname, itemHref(role, other), false),
      )
    );
  }
  function navLink(item: NavItem, label = item.label) {
    const Icon = item.icon;
    return (
      <Link
        href={itemHref(role, item)}
        className={styles.link}
        data-sidebar-nav-link
        aria-current={isActive(item) ? "page" : undefined}
        title={label}
      >
        <Icon aria-hidden="true" className={styles.icon} />
        <span data-sidebar-label>{label}</span>
      </Link>
    );
  }
  return (
    <nav aria-label="Main" className={styles.nav}>
      <div className={styles.mobileIdentity}>
        <strong>{identityName}</strong>
        <span>{resolvedIdentityRole}</span>
      </div>
      <ul className={styles.list}>
        {entries.map(({ item, menu, children }, index) => {
          const showHeading =
            role === "admin" &&
            item.group &&
            (index === 0 || entries[index - 1].item.group !== item.group);
          const heading = showHeading ? (
            <span className={styles.groupHeading} data-sidebar-label>
              {item.group}
            </span>
          ) : null;
          if (!menu)
            return (
              <li
                key={item.slug}
                className={item.overflow ? styles.desktopOnly : styles.item}
              >
                {heading}
                {navLink(item)}
              </li>
            );
          const active = children.some(isActive);
          const open =
            (expanded.path === pathname
              ? expanded.values[menu.id]
              : undefined) ?? active;
          const Icon = menu.icon;
          const controlId = role + "-submenu-" + menu.id;
          return (
            <li key={menu.id} className={styles.submenuItem}>
              {heading}
              <button
                type="button"
                className={styles.groupButton}
                aria-expanded={open}
                aria-controls={controlId}
                data-active={active || undefined}
                title={menu.label}
                onClick={() =>
                  setExpanded((current) => ({
                    path: pathname,
                    values: {
                      ...(current.path === pathname ? current.values : {}),
                      [menu.id]: !open,
                    },
                  }))
                }
              >
                <Icon aria-hidden="true" className={styles.icon} />
                <span data-sidebar-label>{menu.label}</span>
                <ChevronDown className={styles.chevron} aria-hidden="true" />
              </button>
              <ul id={controlId} className={styles.sublist} data-open={open}>
                {children.map((child) => (
                  <li
                    key={child.slug}
                    className={
                      child.overflow ? styles.desktopOnly : styles.item
                    }
                  >
                    {navLink(child, menu.labels?.[child.slug] ?? child.label)}
                  </li>
                ))}
              </ul>
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
